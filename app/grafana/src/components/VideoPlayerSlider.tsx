import { cx, css } from '@emotion/css';
import SliderComponent from 'rc-slider';
import { useCallback } from 'react';

import { useStyles2 } from '@grafana/ui';
import { type GrafanaTheme2 } from '@grafana/data';

interface CommonSliderProps {
  min: number;
  max: number;
  /** Set current positions of handle(s). If only 1 value supplied, only 1 handle displayed. */
  reverse?: boolean;
  step?: number;
  tooltipAlwaysVisible?: boolean;
  disabled: boolean;
}
interface SliderProps extends CommonSliderProps {
  value?: number;
  onChange?: (value: number) => void;
  onAfterChange?: (value?: number) => void;
  formatTooltipResult?: (value: number) => number;
  ariaLabelForHandle?: string;
}

const getStyles = (theme: GrafanaTheme2, isHorizontal: boolean, hasMarks = false) => {
  const { spacing } = theme;
  const railColor = theme.colors.border.strong;
  const trackColor = theme.colors.primary.main;
  const handleColor = theme.colors.primary.main;
  const blueOpacity = theme.colors.primary.transparent;
  const hoverStyle = `box-shadow: 0px 0px 0px 3px ${blueOpacity}`;

  return {
    container: css({
      width: '100%',
      margin: isHorizontal ? 'inherit' : spacing(1, 3, 1, 1),
      paddingBottom: isHorizontal && hasMarks ? theme.spacing(1) : 'inherit',
      height: isHorizontal ? 'auto' : '100%',
    }),
    // can't write this as an object since it needs to overwrite rc-slider styles
    // object syntax doesn't support kebab case keys
    slider: css`
      .rc-slider {
        display: flex;
        flex-grow: 1;
      }
      .rc-slider-mark {
        top: ${theme.spacing(1.75)};
      }
      .rc-slider-mark-text {
        color: ${theme.colors.text.disabled};
        font-size: ${theme.typography.bodySmall.fontSize};
      }
      .rc-slider-mark-text-active {
        color: ${theme.colors.text.primary};
      }
      .rc-slider-handle {
        border: none;
        background-color: ${handleColor};
        cursor: pointer;
        opacity: 1;
        width: 0px;
        height: 0px;
      }

      .rc-slider:hover > .rc-slider-handle,
      .rc-slider-handle-click-focused:focus,
      .rc-slider-handle-dragging,
      .rc-slider-handle:hover {
        width: 12px;
        height: 12px;
      }

      .rc-slider-handle:hover,
      .rc-slider-handle:active,
      .rc-slider-handle-click-focused:focus {
        ${hoverStyle};
      }

      .rc-slider-handle:focus-visible {
        box-shadow: none;
      }

      // The triple class names is needed because that's the specificity used in the source css :(
      .rc-slider-handle-dragging.rc-slider-handle-dragging.rc-slider-handle-dragging {
        box-shadow: 0 0 0 2px ${theme.colors.text.primary};
      }

      .rc-slider-dot,
      .rc-slider-dot-active {
        border: none;
      }

      .rc-slider-track {
        background-color: ${trackColor};
      }
      .rc-slider-rail {
        background-color: ${railColor};
        cursor: pointer;
      }
    `
  };
};

/**
 * @public
 */
export const VideoPlayerSlider = ({
  min,
  max,
  onChange,
  onAfterChange,
  reverse,
  step,
  value,
  disabled,
  ariaLabelForHandle,
}: SliderProps) => {
  const styles = useStyles2(getStyles, true, false);

  const onSliderChange = useCallback(
    (v: number | number[]) => {
      const value = typeof v === 'number' ? v : v[0];

      onChange?.(value);
    },
    [onChange]
  );

  const handleChangeComplete = useCallback(
    (v: number | number[]) => {
      const value = typeof v === 'number' ? v : v[0];
      onAfterChange?.(value);
    },
    [onAfterChange]
  );

  return (
    <div className={cx(styles.container, styles.slider)}>
      <SliderComponent
        min={min}
        max={max}
        disabled={disabled}
        step={step}
        value={value}
        onChange={onSliderChange}
        onChangeComplete={handleChangeComplete}
        vertical={false}
        reverse={reverse}
        ariaLabelForHandle={ariaLabelForHandle}
        included={true}
      />
    </div>
  );
};

VideoPlayerSlider.displayName = 'VideoPlayerSlider';
