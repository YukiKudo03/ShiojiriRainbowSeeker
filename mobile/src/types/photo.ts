/**
 * Photo-related type definitions
 */

/**
 * GPS coordinates
 */
export interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  altitudeAccuracy?: number;
}

/**
 * Photo data captured from camera or gallery
 */
export interface CapturedPhoto {
  uri: string;
  width: number;
  height: number;
  location?: Location;
  exifData?: ExifData;
  timestamp?: string;
}

/**
 * EXIF metadata extracted from image
 */
export interface ExifData {
  DateTimeOriginal?: string;
  GPSLatitude?: number;
  GPSLongitude?: number;
  GPSAltitude?: number;
  Make?: string;
  Model?: string;
  Orientation?: number;
}

/**
 * Photo upload metadata
 */
export interface PhotoUploadMetadata {
  title?: string;
  comment?: string;
  latitude: number;
  longitude: number;
  locationName?: string;
  capturedAt?: string;
}

/**
 * Photo upload request
 */
export interface PhotoUploadRequest {
  image: {
    uri: string;
    type: string;
    name: string;
  };
  metadata: PhotoUploadMetadata;
}

/**
 * Image URLs structure from API
 */
export interface ImageUrls {
  thumbnail: string;
  medium: string;
  large?: string;
  original?: string;
}

/**
 * Photo location from API
 */
export interface PhotoLocation {
  latitude: number;
  longitude: number;
  name?: string;
}

/**
 * Photo user summary from API
 */
export interface PhotoUser {
  id: string;
  displayName: string;
}

/**
 * Photo entity from API (matches backend PhotoService.photo_data)
 */
export interface Photo {
  id: string;
  title?: string;
  description?: string;
  capturedAt: string;
  location: PhotoLocation | null;
  imageUrls: ImageUrls;
  likeCount: number;
  commentCount: number;
  user: PhotoUser;
  createdAt: string;
}

/**
 * Comment data from API
 */
export interface PhotoComment {
  id: string;
  content: string;
  user: PhotoUser;
  createdAt: string;
}

/**
 * Weather summary from API
 */
export interface WeatherSummary {
  temperature?: number;
  humidity?: number;
  weatherDescription?: string;
  cloudCover?: number;
  sunAzimuth?: number;
  sunAltitude?: number;
  rainbowFavorable?: boolean;
}

/**
 * Photo detail with weather data (matches backend PhotoService.photo_data_with_details)
 */
export interface PhotoDetail extends Photo {
  weatherSummary?: WeatherSummary;
  comments?: PhotoComment[];
  likedByCurrentUser: boolean;
  moderationStatus: string;
  isOwner: boolean;
  weatherConditions?: WeatherCondition[];
  radarData?: RadarData[];
}

/**
 * Weather condition data (matches backend weather_condition_data)
 */
export interface WeatherCondition {
  id: string;
  timestamp: string;
  temperature?: number;
  humidity?: number;
  pressure?: number;
  windSpeed?: number;
  windDirection?: number;
  windGust?: number;
  weatherCode?: number;
  weatherDescription?: string;
  precipitation?: number;
  precipitationType?: string;
  cloudCover?: number;
  visibility?: number;
  sunAzimuth?: number;
  sunAltitude?: number;
  rainbowFavorable?: boolean;
}

/**
 * Radar data for precipitation (matches backend radar_datum_data)
 */
export interface RadarData {
  id: string;
  timestamp: string;
  precipitationIntensity?: number;
  precipitationArea?: number;
  radius?: number;
  centerLatitude?: number;
  centerLongitude?: number;
}

/**
 * Photo list response
 */
export interface PhotoListResponse {
  data: Photo[];
  meta: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    perPage: number;
  };
}

/**
 * Photo filters for listing
 */
export interface PhotoFilters {
  page?: number;
  perPage?: number;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  startDate?: string;
  endDate?: string;
  keyword?: string;
  userId?: string;
}

/**
 * Camera permission status
 */
export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

/**
 * Camera facing mode
 */
export type CameraFacing = 'front' | 'back';

/**
 * Image source type
 */
export type ImageSource = 'camera' | 'gallery';
