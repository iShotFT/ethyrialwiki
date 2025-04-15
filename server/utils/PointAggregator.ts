import Logger from "@server/logging/Logger";
import RedisAdapter from "@server/storage/redis";

/**
 * Provides efficient pixel-based point aggregation for game map heatmaps
 * Optimized for a fixed 6000x5000 pixel map with integer coordinates
 */
export class PointAggregator<T extends { x: number; y: number }> {
  /**
   * Configuration options for the aggregator
   */
  private options: {
    // Map dimensions
    mapWidth: number; // 6000 pixels
    mapHeight: number; // 5000 pixels

    // Function to extract the weight value from a data point
    weightFn: (point: T) => number;

    // Minimum grid cell size (in pixels) for aggregation
    minCellSize: number;

    // Maximum grid cell size (in pixels) for aggregation
    maxCellSize: number;

    // Whether to cache results (improves performance for repeated requests)
    useCache: boolean;

    // Filter threshold - cells with fewer points than this are excluded (0 = no filtering)
    minPointsPerCell: number;
  };

  // Cache of previously calculated aggregations (in-memory)
  private aggregationCache: Map<number, AggregatedPoint[]> = new Map();
  // Redis client for distributed caching
  private redisClient: RedisAdapter | null = null;
  // Item ID for constructing cache keys
  private cacheKeyPrefix: string | null = null;
  // Cache TTL
  private readonly CACHE_TTL_SECONDS = 12 * 60 * 60; // 12 hours

  // Original dataset
  private points: T[] = [];

  /**
   * Creates a new point aggregator
   */
  constructor(
    cacheKeyPrefix: string,
    redisClient: RedisAdapter,
    options?: Partial<PointAggregator<T>["options"]>
  ) {
    this.cacheKeyPrefix = cacheKeyPrefix;
    this.redisClient = redisClient;
    this.options = {
      mapWidth: 6000,
      mapHeight: 5000,
      weightFn: () => 1,
      minCellSize: 1, // No aggregation - one pixel per cell
      maxCellSize: 64, // Maximum aggregation - 64x64 pixel cells
      useCache: true,
      minPointsPerCell: 0,
      ...options,
    };
  }

  /**
   * Sets or replaces the dataset to be aggregated
   */
  setData(points: T[]): void {
    this.points = points;
    // Clear only the in-memory cache when data changes
    this.aggregationCache.clear();
  }

  /**
   * Updates configuration options
   */
  setOptions(options: Partial<PointAggregator<T>["options"]>): void {
    this.options = { ...this.options, ...options };
    // Clear only the in-memory cache when options change
    this.aggregationCache.clear();
  }

  /**
   * Calculates grid cell size based on zoom level
   * For OpenLayers, higher zoom levels mean more detail (smaller cells)
   *
   * @param zoomLevel OpenLayers zoom level (typically 0-28)
   * @returns Cell size in pixels
   */
  calculateCellSize(zoomLevel: number): number {
    // Map OpenLayers zoom level (typically 0-28) to our cell size range
    // At max zoom (e.g., 28), we want minCellSize (e.g., 1 pixel)
    // At min zoom (e.g., 0), we want maxCellSize (e.g., 64 pixels)

    // Normalize zoom to 0-1 range (assuming max zoom of 28)
    const normalizedZoom = Math.min(Math.max(zoomLevel / 28, 0), 1);

    // Calculate cell size with inverse relationship to zoom
    // As zoom increases, cell size decreases
    const cellSize =
      this.options.maxCellSize -
      normalizedZoom * (this.options.maxCellSize - this.options.minCellSize);

    // Return as integer
    return Math.max(1, Math.round(cellSize));
  }

  /**
   * Aggregates points based on cell size
   * @param cellSize Size of grid cells in pixels
   * @returns Array of aggregated points
   */
  async getAggregatedPointsByCellSize(
    cellSize: number
  ): Promise<AggregatedPoint[]> {
    // Round cell size to integer
    const intCellSize = Math.max(1, Math.round(cellSize));
    const redisCacheKey = `heatmap:${this.cacheKeyPrefix}:${intCellSize}`;

    // --- 1. Check Redis Cache ---
    if (this.options.useCache && this.redisClient) {
      try {
        const cachedData = await this.redisClient.get(redisCacheKey);
        if (cachedData) {
          Logger.debug(
            "utils",
            `[PointAggregator] HIT Redis cache for key: ${redisCacheKey}`
          );
          const parsedData = JSON.parse(cachedData) as AggregatedPoint[];
          // Populate in-memory cache as well
          this.aggregationCache.set(intCellSize, parsedData);
          return parsedData;
        }
        Logger.debug(
          "utils",
          `[PointAggregator] MISS Redis cache for key: ${redisCacheKey}`
        );
      } catch (error) {
        Logger.error(
          `[PointAggregator] Redis GET error for key ${redisCacheKey}`,
          error as Error
        );
        // Proceed without Redis cache on error
      }
    }

    // --- 2. Check In-Memory Cache ---
    // Check in-memory cache first if enabled (after Redis check)
    if (this.options.useCache && this.aggregationCache.has(intCellSize)) {
      Logger.debug(
        "utils",
        `[PointAggregator] HIT In-Memory cache for cellSize: ${intCellSize}`
      );
      return this.aggregationCache.get(intCellSize)!;
    }
    Logger.debug(
      "utils",
      `[PointAggregator] MISS In-Memory cache for cellSize: ${intCellSize}`
    );

    // If we have no points, return empty array
    if (this.points.length === 0) {
      return [];
    }

    // Use a Map with numeric keys for better performance with integer coordinates
    const gridCells: Map<number, T[]> = new Map();

    // Convert 2D coordinates to 1D cell index for efficiency
    // Formula: cellIndex = (cellY * numHorizontalCells) + cellX
    const numHorizontalCells = Math.ceil(this.options.mapWidth / intCellSize);

    for (const point of this.points) {
      // Calculate cell coordinates
      const cellX = Math.floor(point.x / intCellSize);
      const cellY = Math.floor(point.y / intCellSize);

      // Calculate cell index
      const cellIndex = cellY * numHorizontalCells + cellX;

      if (!gridCells.has(cellIndex)) {
        gridCells.set(cellIndex, []);
      }

      gridCells.get(cellIndex)!.push(point);
    }

    // Aggregate points in each cell
    const aggregatedPoints: AggregatedPoint[] = [];

    gridCells.forEach((cellPoints, _cellIndex) => {
      const pointCount = cellPoints.length;

      // Skip cells with too few points if filtering is enabled
      if (pointCount < this.options.minPointsPerCell) {
        return;
      }

      // Calculate x and y from cell index
      // const cellX = cellIndex % numHorizontalCells;
      // const cellY = Math.floor(cellIndex / numHorizontalCells);

      // Calculate centroid and total weight
      let sumX = 0;
      let sumY = 0;
      let totalWeight = 0;

      for (const point of cellPoints) {
        sumX += point.x;
        sumY += point.y;
        totalWeight += this.options.weightFn(point);
      }

      // Create aggregated point
      // For center position, we use the actual centroid of points rather than cell center
      // This provides more accurate heatmap representation
      aggregatedPoints.push({
        x: sumX / pointCount,
        y: sumY / pointCount,
        weight: totalWeight,
        count: pointCount,
        cellSize: intCellSize,
      });
    });

    // Cache the result if caching is enabled
    if (this.options.useCache) {
      // Cache in memory
      this.aggregationCache.set(intCellSize, aggregatedPoints);
      Logger.debug(
        "utils",
        `[PointAggregator] Stored in In-Memory cache for cellSize: ${intCellSize}`
      );

      // Cache in Redis
      if (this.redisClient) {
        try {
          const jsonData = JSON.stringify(aggregatedPoints);
          await this.redisClient.setex(
            redisCacheKey,
            this.CACHE_TTL_SECONDS,
            jsonData
          );
          Logger.debug(
            "utils",
            `[PointAggregator] Stored in Redis cache: ${redisCacheKey}`
          );
        } catch (error) {
          Logger.error(
            `[PointAggregator] Redis SETEX error for key ${redisCacheKey}`,
            error as Error
          );
          // Continue even if Redis caching fails
        }
      }
    }

    return aggregatedPoints;
  }

  /**
   * Aggregates points for a specific zoom level
   * @param zoomLevel OpenLayers zoom level
   * @returns Array of aggregated points
   */
  async getAggregatedPoints(zoomLevel: number): Promise<AggregatedPoint[]> {
    const cellSize = this.calculateCellSize(zoomLevel);
    // Call the async version now
    return this.getAggregatedPointsByCellSize(cellSize);
  }

  /**
   * Clears the aggregation cache (in-memory only)
   */
  clearCache(): void {
    this.aggregationCache.clear();
    Logger.debug("utils", "[PointAggregator] Cleared in-memory cache.");
  }

  /**
   * Gets appropriate cell sizes for each zoom level
   * Useful for pre-calculating all zoom levels
   *
   * @param minZoom Minimum zoom level
   * @param maxZoom Maximum zoom level
   * @returns Map of zoom levels to cell sizes
   */
  getCellSizesForZoomRange(
    minZoom: number,
    maxZoom: number
  ): Map<number, number> {
    const cellSizes = new Map<number, number>();

    for (let zoom = minZoom; zoom <= maxZoom; zoom++) {
      cellSizes.set(zoom, this.calculateCellSize(zoom));
    }

    return cellSizes;
  }

  /**
   * Pre-calculates aggregations for a range of zoom levels
   * Call this method to prepare data for all zoom levels upfront
   *
   * @param minZoom Minimum zoom level
   * @param maxZoom Maximum zoom level
   */
  async preCalculateForZoomRange(
    minZoom: number,
    maxZoom: number
  ): Promise<void> {
    const cellSizes = this.getCellSizesForZoomRange(minZoom, maxZoom);

    // Get unique cell sizes (multiple zoom levels might use the same cell size)
    const uniqueCellSizes = new Set(cellSizes.values());

    // Calculate aggregations for each unique cell size asynchronously
    const calculationPromises: Promise<AggregatedPoint[]>[] = [];
    uniqueCellSizes.forEach((cellSize) => {
      // Call the async version now
      calculationPromises.push(this.getAggregatedPointsByCellSize(cellSize));
    });

    // Wait for all calculations (and potential caching) to complete
    await Promise.all(calculationPromises);
    Logger.info(
      "utils",
      `[PointAggregator] Pre-calculated aggregations for prefix ${this.cacheKeyPrefix} and ${uniqueCellSizes.size} cell sizes.`
    );
  }
}

/**
 * Represents an aggregated point for heatmap rendering
 */
export interface AggregatedPoint {
  x: number; // X coordinate (centroid of all points in cell)
  y: number; // Y coordinate (centroid of all points in cell)
  weight: number; // Combined weight of all points in the cell
  count: number; // Number of original points in this cell
  cellSize: number; // Size of the cell that created this aggregation
}

/**
 * Example usage:
 *
 * // Define your resource point type
 * interface ResourcePoint {
 *   x: number;
 *   y: number;
 *   resourceValue: number;
 *   resourceType: string;
 * }
 *
 * // Create aggregator with custom weight function
 * const aggregator = new PointAggregator<ResourcePoint>({
 *   weightFn: point => point.resourceValue,
 *   minPointsPerCell: 2 // Only show cells with at least 2 points
 * });
 *
 * // Set data
 * aggregator.setData(resourcePoints);
 *
 * // Pre-calculate for common zoom levels
 * aggregator.preCalculateForZoomRange(0, 20);
 *
 * // Later, in OpenLayers view change handler
 * const currentZoom = map.getView().getZoom();
 * const aggregatedPoints = aggregator.getAggregatedPoints(currentZoom);
 *
 * // Use aggregatedPoints to update heatmap features
 */
