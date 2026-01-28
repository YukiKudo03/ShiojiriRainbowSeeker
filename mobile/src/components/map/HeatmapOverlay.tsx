/**
 * HeatmapOverlay - Rainbow sighting frequency heatmap layer
 *
 * Displays a heatmap visualization of rainbow sighting frequency on the map.
 * Color gradient from blue (low frequency) to red (high frequency).
 *
 * Accessibility features (WCAG 2.1 AA):
 * - Screen reader support for heatmap state
 * - Clear visibility toggle with accessible button
 *
 * Requirements: FR-13 (AC-13.5)
 */

import React, { useMemo } from 'react';

import { Heatmap } from 'react-native-maps';

import type { HeatmapPoint } from '../../services/mapService';

// ============================================
// Types
// ============================================

interface HeatmapOverlayProps {
  /** Heatmap data points with weights */
  points: HeatmapPoint[];
  /** Whether the heatmap is visible */
  visible?: boolean;
  /** Opacity of the heatmap layer (0-1) */
  opacity?: number;
  /** Radius of heatmap points in pixels */
  radius?: number;
}

// ============================================
// Constants
// ============================================

/**
 * Color gradient for heatmap visualization
 * Blue (low) -> Green -> Yellow -> Orange -> Red (high)
 */
const HEATMAP_GRADIENT = {
  colors: [
    '#0000FF', // Blue - lowest frequency
    '#00FFFF', // Cyan
    '#00FF00', // Green
    '#FFFF00', // Yellow
    '#FFA500', // Orange
    '#FF0000', // Red - highest frequency
  ],
  startPoints: [0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
  colorMapSize: 256,
};

/**
 * Default heatmap configuration
 */
const DEFAULT_OPACITY = 0.6;
const DEFAULT_RADIUS = 30;

// ============================================
// Component
// ============================================

export const HeatmapOverlay: React.FC<HeatmapOverlayProps> = ({
  points,
  visible = true,
  opacity = DEFAULT_OPACITY,
  radius = DEFAULT_RADIUS,
}) => {
  /**
   * Convert HeatmapPoint to WeightedLatLng format
   */
  const weightedPoints = useMemo(() => {
    return points.map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
      weight: point.weight,
    }));
  }, [points]);

  // Don't render if not visible or no points
  if (!visible || weightedPoints.length === 0) {
    return null;
  }

  return (
    <Heatmap
      points={weightedPoints}
      opacity={opacity}
      radius={radius}
      gradient={HEATMAP_GRADIENT}
    />
  );
};

export default HeatmapOverlay;
