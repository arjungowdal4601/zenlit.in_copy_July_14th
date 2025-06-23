import { supabase } from './supabase';
import { UserLocation, LocationPermissionStatus } from '../types';

// Check if geolocation is supported
export const isGeolocationSupported = (): boolean => {
  return 'geolocation' in navigator;
};

// Check if we're in a secure context (required for geolocation)
export const isSecureContext = (): boolean => {
  return window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost';
};

// Request user's current location
export const requestUserLocation = async (): Promise<{
  success: boolean;
  location?: UserLocation;
  error?: string;
}> => {
  try {
    // Check if geolocation is supported
    if (!isGeolocationSupported()) {
      return {
        success: false,
        error: 'Geolocation is not supported by this browser'
      };
    }

    // Check if we're in a secure context
    if (!isSecureContext()) {
      return {
        success: false,
        error: 'Location access requires a secure connection (HTTPS)'
      };
    }

    console.log('Requesting user location...');

    // Request location with high accuracy and increased timeout
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: true,
          timeout: 30000, // Increased to 30 seconds timeout
          maximumAge: 60000 // 1 minute cache for dynamic updates
        }
      );
    });

    // Round coordinates to 2 decimal places for privacy and performance
    const location: UserLocation = {
      latitude: Number(position.coords.latitude.toFixed(2)),
      longitude: Number(position.coords.longitude.toFixed(2)),
      accuracy: position.coords.accuracy,
      timestamp: Date.now()
    };

    console.log('Location obtained:', location);

    return {
      success: true,
      location
    };

  } catch (error: any) {
    console.error('Location request error:', error);

    let errorMessage = 'Failed to get your location. ';

    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage += 'Location access was denied. Please enable location permissions in your browser settings.';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage += 'Location information is unavailable. Please check your device settings.';
        break;
      case error.TIMEOUT:
        errorMessage += 'Location request timed out. Please try again.';
        break;
      default:
        errorMessage += error.message || 'Unknown error occurred.';
        break;
    }

    return {
      success: false,
      error: errorMessage
    };
  }
};

// Watch user's location for changes (dynamic tracking)
export const watchUserLocation = (
  onLocationUpdate: (location: UserLocation) => void,
  onError: (error: string) => void
): number | null => {
  try {
    if (!isGeolocationSupported()) {
      onError('Geolocation is not supported by this browser');
      return null;
    }

    if (!isSecureContext()) {
      onError('Location access requires a secure connection (HTTPS)');
      return null;
    }

    console.log('Starting location watch...');

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        // Round coordinates to 2 decimal places for privacy and performance
        const location: UserLocation = {
          latitude: Number(position.coords.latitude.toFixed(2)),
          longitude: Number(position.coords.longitude.toFixed(2)),
          accuracy: position.coords.accuracy,
          timestamp: Date.now()
        };

        console.log('Location updated:', location);
        onLocationUpdate(location);
      },
      (error) => {
        console.error('Location watch error:', error);
        
        let errorMessage = 'Failed to track location. ';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += 'Location access was denied.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage += 'Location request timed out.';
            break;
          default:
            errorMessage += error.message || 'Unknown error occurred.';
            break;
        }
        
        onError(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 60000, // Increased to 60 seconds timeout for watch
        maximumAge: 30000 // 30 seconds cache for dynamic updates
      }
    );

    return watchId;

  } catch (error: any) {
    console.error('Error starting location watch:', error);
    onError('Failed to start location tracking');
    return null;
  }
};

// Stop watching user's location
export const stopWatchingLocation = (watchId: number): void => {
  try {
    navigator.geolocation.clearWatch(watchId);
    console.log('Location watch stopped');
  } catch (error) {
    console.error('Error stopping location watch:', error);
  }
};

// Save user's location to their profile (with rounded coordinates)
export const saveUserLocation = async (
  userId: string,
  location: UserLocation
): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    // Validate userId before proceeding
    if (!userId || userId === 'null' || userId === 'undefined' || typeof userId !== 'string') {
      console.error('Invalid user ID provided:', userId);
      return {
        success: false,
        error: 'Invalid user ID provided'
      };
    }

    console.log('Saving user location to profile:', userId, location);

    // Round coordinates to 2 decimal places before saving
    const latRounded = Number(location.latitude.toFixed(2));
    const lonRounded = Number(location.longitude.toFixed(2));

    const { error } = await supabase
      .from('profiles')
      .update({
        latitude: latRounded,
        longitude: lonRounded,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error('Location save error:', error);
      return {
        success: false,
        error: 'Failed to save location to profile'
      };
    }

    console.log('Location saved successfully');
    return { success: true };

  } catch (error) {
    console.error('Location save error:', error);
    return {
      success: false,
      error: 'Failed to save location'
    };
  }
};

// Check if location coordinates have changed (rounded comparison)
export const hasLocationChanged = (
  oldLocation: UserLocation,
  newLocation: UserLocation
): boolean => {
  const oldLatRounded = Number(oldLocation.latitude.toFixed(2));
  const oldLonRounded = Number(oldLocation.longitude.toFixed(2));
  const newLatRounded = Number(newLocation.latitude.toFixed(2));
  const newLonRounded = Number(newLocation.longitude.toFixed(2));
  
  return oldLatRounded !== newLatRounded || oldLonRounded !== newLonRounded;
};

// Define the type for users returned by the RPC function
interface DatabaseUser {
  id: string;
  name: string;
  username?: string;
  email: string;
  bio: string;
  profile_photo_url?: string;
  cover_photo_url?: string;
  instagram_url?: string;
  linked_in_url?: string;
  twitter_url?: string;
  latitude: number;
  longitude: number;
  distance_km: number;
}

// Get nearby users using database RPC function for exact coordinate matching
export const getNearbyUsers = async (
  currentUserId: string,
  currentLocation: UserLocation,
  limit: number = 20
): Promise<{
  success: boolean;
  users?: any[];
  error?: string;
}> => {
  try {
    console.log('🔍 LOCATION DEBUG: Using database RPC for nearby users');
    console.log('📍 Current user ID:', currentUserId);
    console.log('📍 Current location:', currentLocation);
    console.log('📍 Limit:', limit);

    // Round coordinates to 2 decimal places for exact matching
    const latRounded = Number(currentLocation.latitude.toFixed(2));
    const lonRounded = Number(currentLocation.longitude.toFixed(2));

    console.log('📍 Rounded coordinates for RPC call:', { latRounded, lonRounded });

    // Use the database RPC function with correct parameter order
    const { data: users, error } = await supabase
      .rpc('get_users_in_location_bucket', {
        current_user_id: currentUserId,
        user_lat: latRounded,
        user_lng: lonRounded
      });

    console.log('🔍 LOCATION DEBUG: RPC response:', { users, error });

    if (error) {
      console.error('Error calling RPC function:', error);
      return {
        success: false,
        error: 'Failed to fetch nearby users'
      };
    }

    if (!users || users.length === 0) {
      console.log('🔍 LOCATION DEBUG: No users found in same location bucket');
      return {
        success: true,
        users: []
      };
    }

    console.log('🔍 LOCATION DEBUG: Found', users.length, 'users in same location bucket');

    // The RPC function already returns properly formatted user data
    // with distance_km set to 0 for all users in the same bucket
    const usersWithDistance = users.map((user: DatabaseUser, index: number) => {
      console.log(`🔍 LOCATION DEBUG: Processing user ${index + 1}/${users.length}`);
      console.log('👤 User ID:', user.id);
      console.log('👤 User name:', user.name);
      console.log('👤 User latitude:', user.latitude);
      console.log('👤 User longitude:', user.longitude);
      console.log('👤 Distance:', user.distance_km);

      return {
        ...user,
        hasRealLocation: true
      };
    });

    console.log('🔍 LOCATION DEBUG: Final processed users:', usersWithDistance);
    console.log('🔍 LOCATION DEBUG: Final user count:', usersWithDistance.length);

    usersWithDistance.forEach((user, index) => {
      console.log(`📋 Final user ${index + 1}: ${user.name} - same location bucket (distance: ${user.distance_km}km)`);
    });

    return {
      success: true,
      users: usersWithDistance
    };

  } catch (error) {
    console.error('🔍 LOCATION DEBUG: Error in getNearbyUsers:', error);
    return {
      success: false,
      error: 'Failed to get nearby users'
    };
  }
};

// Check location permission status
export const checkLocationPermission = async (): Promise<LocationPermissionStatus> => {
  try {
    if (!isGeolocationSupported()) {
      return {
        granted: false,
        denied: true,
        pending: false,
        error: 'Geolocation not supported'
      };
    }

    // Check permission using the Permissions API if available
    if ('permissions' in navigator) {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      
      switch (permission.state) {
        case 'granted':
          return { granted: true, denied: false, pending: false };
        case 'denied':
          return { granted: false, denied: true, pending: false };
        case 'prompt':
          return { granted: false, denied: false, pending: true };
        default:
          return { granted: false, denied: false, pending: true };
      }
    }

    // Fallback: assume permission is pending if we can't check
    return { granted: false, denied: false, pending: true };

  } catch (error) {
    console.error('Error checking location permission:', error);
    return {
      granted: false,
      denied: false,
      pending: true,
      error: 'Unable to check location permission'
    };
  }
};

// Request location permission and get location
export const requestLocationAndSave = async (
  userId: string,
  existingLocation?: string
): Promise<{
  success: boolean;
  location?: UserLocation;
  error?: string;
}> => {
  try {
    // Validate userId before proceeding
    if (!userId || userId === 'null' || userId === 'undefined' || typeof userId !== 'string') {
      console.error('Invalid user ID provided to requestLocationAndSave:', userId);
      return {
        success: false,
        error: 'Invalid user ID provided'
      };
    }

    // First request the location
    const locationResult = await requestUserLocation();
    
    if (!locationResult.success || !locationResult.location) {
      return {
        success: false,
        error: locationResult.error
      };
    }

    // Save the location to user's profile
    const saveResult = await saveUserLocation(userId, locationResult.location);
    
    if (!saveResult.success) {
      return {
        success: false,
        error: saveResult.error
      };
    }

    return {
      success: true,
      location: locationResult.location
    };

  } catch (error) {
    console.error('Error requesting location and saving:', error);
    return {
      success: false,
      error: 'Failed to get and save location'
    };
  }
};

// Debounced location update function
export const createDebouncedLocationUpdate = (
  callback: (location: UserLocation) => void,
  delay: number = 2000 // 2 seconds
) => {
  let timeoutId: NodeJS.Timeout;
  
  return (location: UserLocation) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      callback(location);
    }, delay);
  };
};