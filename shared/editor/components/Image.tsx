import { CrossIcon, DownloadIcon, GlobeIcon } from "outline-icons";
import type { EditorView } from "prosemirror-view";
import * as React from "react";
import styled from "styled-components";
import Flex from "../../components/Flex";
import { s } from "../../styles";
import { isExternalUrl, sanitizeUrl } from "../../utils/urls";
import { EditorStyleHelper } from "../styles/EditorStyleHelper";
import { ComponentProps } from "../types";
import { ImageZoom } from "./ImageZoom";
import { ResizeLeft, ResizeRight } from "./ResizeHandle";
import useDragResize from "./hooks/useDragResize";

type Props = ComponentProps & {
  /** Callback triggered when the image is clicked */
  onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  /** Callback triggered when the download button is clicked */
  onDownload?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Callback triggered when the image is resized */
  onChangeSize?: (props: { width: number; height?: number }) => void;
  /** The editor view */
  view: EditorView;
  children?: React.ReactElement;
};

const Image = (props: Props) => {
  const { isSelected, node, isEditable, onChangeSize } = props;
  const { src, layoutClass } = node.attrs;
  const className = layoutClass ? `image image-${layoutClass}` : "image";
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [naturalWidth, setNaturalWidth] = React.useState(node.attrs.width);
  const [naturalHeight, setNaturalHeight] = React.useState(node.attrs.height);
  const ref = React.useRef<HTMLDivElement>(null);
  const { width, height, setSize, handlePointerDown, dragging } = useDragResize(
    {
      width: node.attrs.width ?? naturalWidth,
      height: node.attrs.height ?? naturalHeight,
      naturalWidth,
      naturalHeight,
      gridSnap: 5,
      onChangeSize,
      ref,
    }
  );

  const isFullWidth = layoutClass === "full-width";
  const isResizable = !!props.onChangeSize && !error;
  const isDownloadable = !!props.onDownload && !error;

  React.useEffect(() => {
    if (node.attrs.width && node.attrs.width !== width) {
      setSize({
        width: node.attrs.width,
        height: node.attrs.height,
      });
    }
  }, [node.attrs.width]);

  const sanitizedSrc = sanitizeUrl(src);

  const handleOpen = React.useCallback(() => {
    window.open(sanitizedSrc, "_blank");
  }, [sanitizedSrc]);

  const widthStyle = isFullWidth
    ? { width: "var(--container-width)" }
    : { width: width || "auto" };

  const handleImageError = (_err: unknown) => {
    setError(true);
    setLoaded(true);
  };

  return (
    <div contentEditable={false} className={className} ref={ref}>
      <ImageWrapper
        isFullWidth={isFullWidth}
        className={isSelected || dragging ? "ProseMirror-selectednode" : ""}
        onClick={dragging ? undefined : props.onClick}
        style={widthStyle}
      >
        {!dragging && width > 60 && isDownloadable && (
          <Actions>
            {isExternalUrl(src) && (
              <Button onClick={handleOpen}>
                <GlobeIcon />
              </Button>
            )}
            <Button onClick={props.onDownload}>
              <DownloadIcon />
            </Button>
          </Actions>
        )}
        {error ? (
          <Error style={widthStyle} className={EditorStyleHelper.imageHandle}>
            <CrossIcon size={16} /> Image failed to load
          </Error>
        ) : (
          <ImageZoom caption={props.node.attrs.alt}>
            <img
              className={EditorStyleHelper.imageHandle}
              style={{
                ...widthStyle,
                display: loaded ? "block" : "none",
                pointerEvents:
                  dragging || (!props.isSelected && props.isEditable)
                    ? "none"
                    : "all",
              }}
              src={sanitizedSrc}
              onError={handleImageError}
              onLoad={(ev: React.SyntheticEvent<HTMLImageElement>) => {
                try {
                  const nw =
                    (ev.target as HTMLImageElement).naturalWidth || 300;
                  const nh = (ev.target as HTMLImageElement).naturalHeight;
                  setNaturalWidth(nw);
                  setNaturalHeight(nh);
                  setLoaded(true);

                  if (!node.attrs.width) {
                    setSize((state) => ({
                      ...state,
                      width: nw,
                    }));
                  }
                } catch (err) {
                  handleImageError(err);
                }
              }}
            />
            {!loaded && width && height && (
              <img
                style={{
                  ...widthStyle,
                  display: "block",
                }}
                src={`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
                  getPlaceholder(width, height)
                )}`}
              />
            )}
          </ImageZoom>
        )}
        {isEditable && !isFullWidth && isResizable && (
          <>
            <ResizeLeft
              onPointerDown={handlePointerDown("left")}
              $dragging={!!dragging}
            />
            <ResizeRight
              onPointerDown={handlePointerDown("right")}
              $dragging={!!dragging}
            />
          </>
        )}
      </ImageWrapper>
      {isFullWidth && props.children
        ? React.cloneElement(props.children, { style: widthStyle })
        : props.children}
    </div>
  );
};

function getPlaceholder(width: number, height: number) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" fill="#E6E6E6"/></svg>`;
}

const Error = styled(Flex)`
  max-width: 100%;
  color: ${s("textTertiary")};
  font-size: 14px;
  background: ${s("backgroundSecondary")};
  border-radius: 4px;
  min-width: 33vw;
  height: 80px;
  align-items: center;
  justify-content: center;
  user-select: none;
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  position: absolute;
  gap: 1px;
  top: 8px;
  right: 8px;
  opacity: 0;
  transition: opacity 150ms ease-in-out;

  &:hover {
    opacity: 1;
  }
`;

const Button = styled.button`
  border: 0;
  margin: 0;
  padding: 0;
  border-radius: 4px;
  background: ${s("background")};
  color: ${s("textSecondary")};
  width: 24px;
  height: 24px;
  display: inline-block;
  cursor: var(--pointer) !important;
  transition: opacity 150ms ease-in-out;

  &:first-child:not(:last-child) {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  &:last-child:not(:first-child) {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  &:active {
    transform: scale(0.98);
  }

  &:hover {
    color: ${s("text")};
  }
`;

const ImageWrapper = styled.div<{ isFullWidth: boolean }>`
  line-height: 0;
  position: relative;
  margin-left: auto;
  margin-right: auto;
  max-width: ${(props) => (props.isFullWidth ? "initial" : "100%")};
  transition-property: width, height;
  transition-duration: ${(props) => (props.isFullWidth ? "0ms" : "150ms")};
  transition-timing-function: ease-in-out;
  overflow: hidden;

  img {
    transition-property: width, height;
    transition-duration: ${(props) => (props.isFullWidth ? "0ms" : "150ms")};
    transition-timing-function: ease-in-out;
  }

  &:hover {
    ${Actions} {
      opacity: 0.9;
    }

    ${ResizeLeft}, ${ResizeRight} {
      opacity: 1;
    }
  }
`;

export default Image;
