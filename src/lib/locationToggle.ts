// Location toggle management with clean state transitions
import { supabase } from './supabase';
import { 
  requestUserLocation, 
  watchUserLocation, 
  stopWatchingLocation,
  saveUserLocation,
  isGeolocationSupported,
  isSecureContext,
  hasLocationChanged // Add this import
} from './location';
import type { UserLocation } from '../types';

interface LocationToggleState {
  isEnabled: boolean;
  isTracking: boolean;
  watchId: number | null;
  intervalId: NodeJS.Timeout | null;
  currentLocation: UserLocation | null;
}

class LocationToggleManager {
  private state: LocationToggleState = {
    isEnabled: false,
    isTracking: false,
    watchId: null,
    intervalId: null,
    currentLocation: null
  };

  private userId: string | null = null;
  private onLocationUpdate?: (location: UserLocation | null) => void;
  private onError?: (error: string) => void;

  constructor() {
    // Initialize with OFF state
    this.state.isEnabled = false;
  }

  // Initialize the manager with user ID and callbacks
  initialize(
    userId: string, 
    onLocationUpdate?: (location: UserLocation | null) => void,
    onError?: (error: string) => void
  ) {
    this.userId = userId;
    this.onLocationUpdate = onLocationUpdate;
    this.onError = onError;
  }

  // Get current toggle state
  getState() {
    return { ...this.state };
  }

  // Turn location tracking ON
  async turnOn(): Promise<{ success: boolean; error?: string }> {
    if (!this.userId) {
      return { success: false, error: 'User not initialized' };
    }

    if (this.state.isEnabled) {
      return { success: true }; // Already on
    }

    try {
      console.log('🔄 Location Toggle: Turning ON');

      // Check if geolocation is supported
      if (!isGeolocationSupported() || !isSecureContext()) {
        return { success: false, error: 'Location not supported or requires HTTPS' };
      }

      // Request location permission and get current location
      const locationResult = await requestUserLocation();
      
      if (!locationResult.success || !locationResult.location) {
        return { success: false, error: locationResult.error || 'Failed to get location' };
      }

      // Save location to database
      const saveResult = await saveUserLocation(this.userId, locationResult.location);
      if (!saveResult.success) {
        return { success: false, error: saveResult.error || 'Failed to save location' };
      }

      // Update state
      this.state.isEnabled = true;
      this.state.currentLocation = locationResult.location;

      // Start continuous tracking
      this.startTracking();

      // Notify callback
      if (this.onLocationUpdate) {
        this.onLocationUpdate(locationResult.location);
      }

      console.log('✅ Location Toggle: Successfully turned ON');
      return { success: true };

    } catch (error) {
      console.error('❌ Location Toggle: Error turning ON:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Turn location tracking OFF
  async turnOff(): Promise<{ success: boolean; error?: string }> {
    if (!this.userId) {
      return { success: false, error: 'User not initialized' };
    }

    if (!this.state.isEnabled) {
      return { success: true }; // Already off
    }

    try {
      console.log('🔄 Location Toggle: Turning OFF');

      // Stop all tracking
      this.stopTracking();

      // Clear location from database (set to null)
      const { error } = await supabase
        .from('profiles')
        .update({
          latitude: null,
          longitude: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.userId);

      if (error) {
        console.error('Failed to clear location from database:', error);
        return { success: false, error: 'Failed to clear location from database' };
      }

      // Update state
      this.state.isEnabled = false;
      this.state.currentLocation = null;

      // Notify callback
      if (this.onLocationUpdate) {
        this.onLocationUpdate(null);
      }

      console.log('✅ Location Toggle: Successfully turned OFF');
      return { success: true };

    } catch (error) {
      console.error('❌ Location Toggle: Error turning OFF:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Start continuous location tracking
  private startTracking() {
    if (this.state.isTracking) {
      return; // Already tracking
    }

    console.log('🎯 Starting continuous location tracking');

    // Start watching location changes
    const watchId = watchUserLocation(
      (location: UserLocation) => {
        this.handleLocationUpdate(location);
      },
      (error: string) => {
        console.error('Location watch error:', error);
        if (this.onError) {
          this.onError(error);
        }
      }
    );

    if (watchId !== null) {
      this.state.watchId = watchId;
    }

    // Start interval for periodic updates (every 60 seconds)
    this.state.intervalId = setInterval(() => {
      this.updateLocationPeriodically();
    }, 60000); // 60 seconds

    this.state.isTracking = true;
  }

  // Stop all location tracking
  private stopTracking() {
    if (!this.state.isTracking) {
      return; // Already stopped
    }

    console.log('🛑 Stopping location tracking');

    // Stop watching location
    if (this.state.watchId !== null) {
      stopWatchingLocation(this.state.watchId);
      this.state.watchId = null;
    }

    // Clear interval
    if (this.state.intervalId !== null) {
      clearInterval(this.state.intervalId);
      this.state.intervalId = null;
    }

    this.state.isTracking = false;
  }

  // Handle location updates from watch
  private async handleLocationUpdate(location: UserLocation) {
    if (!this.state.isEnabled || !this.userId) {
      return; // Don't update if toggle is OFF
    }

    // Use the hasLocationChanged utility function for proper 2-decimal comparison
    const changed = !this.state.currentLocation || hasLocationChanged(this.state.currentLocation, location);

    if (changed) {
      console.log('📍 Location bucket changed, updating database');
      
      // Save to database
      const saveResult = await saveUserLocation(this.userId, location);
      if (saveResult.success) {
        this.state.currentLocation = location;
        
        // Notify callback
        if (this.onLocationUpdate) {
          this.onLocationUpdate(location);
        }
      }
    }
  }

  // Periodic location update (every 60 seconds)
  private async updateLocationPeriodically() {
    if (!this.state.isEnabled || !this.userId) {
      return; // Don't update if toggle is OFF
    }

    try {
      const locationResult = await requestUserLocation();
      
      if (locationResult.success && locationResult.location) {
        await this.handleLocationUpdate(locationResult.location);
      }
    } catch (error) {
      console.error('Periodic location update error:', error);
    }
  }

  // Manual location refresh (for screen refresh and toggle ON)
  async refreshLocation(): Promise<{ success: boolean; error?: string }> {
    if (!this.state.isEnabled || !this.userId) {
      return { success: false, error: 'Location toggle is OFF or user not initialized' };
    }

    try {
      const locationResult = await requestUserLocation();
      
      if (locationResult.success && locationResult.location) {
        const saveResult = await saveUserLocation(this.userId, locationResult.location);
        
        if (saveResult.success) {
          this.state.currentLocation = locationResult.location;
          
          // Notify callback
          if (this.onLocationUpdate) {
            this.onLocationUpdate(locationResult.location);
          }
          
          return { success: true };
        } else {
          return { success: false, error: saveResult.error };
        }
      } else {
        return { success: false, error: locationResult.error };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Cleanup when component unmounts
  cleanup() {
    console.log('🧹 Cleaning up location toggle manager');
    this.stopTracking();
    this.state.currentLocation = null;
    this.userId = null;
    this.onLocationUpdate = undefined;
    this.onError = undefined;
  }
}

// Export singleton instance
export const locationToggleManager = new LocationToggleManager();