import * as ol from "ol";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import { fromLonLat } from "ol/proj";
import { OSM } from "ol/source";
import { useEffect } from "react";
import * as React from "react";

/**
 * This component finds map placeholders and initializes OpenLayers maps
 */
const MapNodeViewLoader: React.FC = () => {
  useEffect(() => {
    console.log("MapNodeViewLoader useEffect running");

    // Load OpenLayers CSS
    if (!document.querySelector('link[href*="ol.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/ol@v7.4.0/ol.css";
      document.head.appendChild(link);
      console.log("OpenLayers CSS loaded");
    }

    // Store map instances to clean up later
    const maps: ol.Map[] = [];
    // Keep track of elements we've already processed
    const processedElements = new Set<Element>();

    // Function to scan the DOM and initialize maps
    const initializeMaps = () => {
      // Try multiple selectors that might match map elements
      const selectors = [
        ".map-block-placeholder",
        ".map-block",
        "div[data-map]",
        "div[data-x][data-y]",
      ];

      selectors.forEach((selector) => {
        const elements = document.querySelectorAll(selector);
        console.log(
          `Found ${elements.length} elements matching selector: ${selector}`
        );

        elements.forEach((element) => {
          // Skip elements we've already processed
          if (processedElements.has(element)) {
            return;
          }

          // Mark as processed
          processedElements.add(element);

          // Get attributes from the element
          const x = parseInt(element.getAttribute("data-x") || "0", 10);
          const y = parseInt(element.getAttribute("data-y") || "0", 10);
          const z = parseInt(element.getAttribute("data-z") || "0", 10);
          const mapName = element.getAttribute("data-map") || "irumesa";

          console.log(`Processing map element:`, {
            x,
            y,
            z,
            mapName,
            element,
            className: element.className,
            innerHTML:
              element.innerHTML.substring(0, 50) +
              (element.innerHTML.length > 50 ? "..." : ""),
          });

          // Create a container for the map
          const mapContainer = document.createElement("div");
          mapContainer.className = "ethyrial-map-container";
          mapContainer.style.width = "100%";
          mapContainer.style.height = "300px";
          mapContainer.style.position = "relative";
          mapContainer.style.backgroundColor = "#f5f5f5";
          mapContainer.style.border = "1px solid #e0e0e0";
          mapContainer.style.borderRadius = "4px";
          mapContainer.style.margin = "1em 0";

          // Replace the element's contents with our container
          element.innerHTML = "";
          element.appendChild(mapContainer);

          // Create the OpenLayers map
          try {
            console.log(`Creating OpenLayers map for element`);
            const map = new ol.Map({
              target: mapContainer,
              layers: [
                new TileLayer({
                  source: new OSM(),
                }),
              ],
              view: new View({
                center: fromLonLat([x / 10, y / 10]), // Convert game coordinates to longitude/latitude
                zoom: 6,
                maxZoom: 19,
                minZoom: 1,
              }),
              controls: [], // Remove default controls for cleaner look
            });

            maps.push(map);
            console.log(`Map created successfully:`, map);

            // Force map to render properly
            setTimeout(() => {
              map.updateSize();
              console.log(`Map size updated`);
            }, 100);

            // Add a label showing the coordinates
            const label = document.createElement("div");
            label.style.position = "absolute";
            label.style.bottom = "10px";
            label.style.left = "10px";
            label.style.zIndex = "1";
            label.style.backgroundColor = "rgba(255, 255, 255, 0.7)";
            label.style.padding = "5px";
            label.style.borderRadius = "3px";
            label.style.fontSize = "12px";
            label.style.fontFamily = "monospace";
            label.textContent = `Map: ${mapName} (${x}, ${y}, ${z})`;
            mapContainer.appendChild(label);
          } catch (error) {
            // Handle initialization errors
            console.error(`Error creating map:`, error);
            mapContainer.textContent = `Error initializing map: ${
              error instanceof Error ? error.message : String(error)
            }`;
          }
        });
      });
    };

    // Run immediately
    initializeMaps();

    // Set up mutation observer to watch for new map elements
    const observer = new MutationObserver((mutations) => {
      console.log("DOM mutations detected:", mutations.length);
      // Look for new map elements
      initializeMaps();
    });

    // Start observing the document with the configured parameters
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false,
    });

    // Also set an interval as a fallback
    const intervalId = setInterval(() => {
      console.log("Interval check for new map elements");
      initializeMaps();
    }, 2000);

    // Clean up when component unmounts
    return () => {
      console.log("MapNodeViewLoader cleanup, removing maps:", maps.length);
      maps.forEach((map) => {
        map.setTarget(undefined); // Remove reference to DOM
      });
      observer.disconnect();
      clearInterval(intervalId);
    };
  }, []);

  return null;
};

export default MapNodeViewLoader;
