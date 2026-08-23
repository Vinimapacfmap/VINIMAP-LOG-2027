import L from 'leaflet';

/**
 * Patches Leaflet's DOM utility functions and class prototypes to prevent `TypeError: Cannot read properties of undefined (reading '_leaflet_pos')`
 * when accessing positions on detached, unmounted, or transitioning DOM elements during map animations, zooms, recalibrations or marker updates.
 */
export function initLeafletPosGuard() {
  if (typeof window === 'undefined') return;

  // Ensure global L is assigned so both window.L and module imports use the same reference
  (window as any).L = L;

  // Add global window error handler as a safety net for any uncaught _leaflet_pos exceptions
  if (!(window as any)._leafletPosErrorListenerAdded) {
    (window as any)._leafletPosErrorListenerAdded = true;
    window.addEventListener(
      'error',
      (event: ErrorEvent) => {
        if (
          event?.error?.message?.includes('_leaflet_pos') ||
          event?.message?.includes('_leaflet_pos')
        ) {
          event.preventDefault();
          event.stopPropagation();
          console.warn('[Leaflet PosGuard] Suppressed uncaught _leaflet_pos exception on unmounted element.');
        }
      },
      true
    );
  }

  if (L && L.DomUtil && !(L.DomUtil as any)._leafletPosGuarded) {
    (L.DomUtil as any)._leafletPosGuarded = true;

    // 1. Guard L.DomUtil.getPosition
    L.DomUtil.getPosition = function (el: any) {
      if (!el) {
        return new L.Point(0, 0);
      }
      try {
        return el._leaflet_pos || new L.Point(0, 0);
      } catch (err) {
        return new L.Point(0, 0);
      }
    };

    // 2. Guard L.DomUtil.setPosition
    const originalSetPosition = L.DomUtil.setPosition;
    L.DomUtil.setPosition = function (el: any, point: any) {
      if (!el) return;
      try {
        originalSetPosition.call(L.DomUtil, el, point);
      } catch (err) {
        // Suppress position assignment errors on detached or destroyed map elements
      }
    };

    // 3. Guard L.Map.prototype._getMapPanePos
    if (L.Map && L.Map.prototype) {
      const origGetMapPanePos = (L.Map.prototype as any)._getMapPanePos;
      if (origGetMapPanePos) {
        (L.Map.prototype as any)._getMapPanePos = function (...args: any[]) {
          if (!this._mapPane) return new L.Point(0, 0);
          try {
            return origGetMapPanePos.apply(this, args) || new L.Point(0, 0);
          } catch (err) {
            return new L.Point(0, 0);
          }
        };
      }
    }

    // 4. Guard L.Marker.prototype._setPos & _updateZIndex
    if (L.Marker && L.Marker.prototype) {
      const origMarkerSetPos = (L.Marker.prototype as any)._setPos;
      if (origMarkerSetPos) {
        (L.Marker.prototype as any)._setPos = function (pos: any, ...args: any[]) {
          if (!this._icon || !pos) return;
          try {
            return origMarkerSetPos.call(this, pos, ...args);
          } catch (err) {
            // Suppress error if marker element was unmounted
          }
        };
      }

      const origMarkerUpdateZIndex = (L.Marker.prototype as any)._updateZIndex;
      if (origMarkerUpdateZIndex) {
        (L.Marker.prototype as any)._updateZIndex = function (...args: any[]) {
          if (!this._icon) return;
          try {
            return origMarkerUpdateZIndex.apply(this, args);
          } catch (err) {
            // Suppress error
          }
        };
      }
    }

    // 5. Guard L.PosAnimation prototype
    const posAnimProto = L.PosAnimation && (L.PosAnimation.prototype as any);
    if (posAnimProto) {
      const origStep = posAnimProto._step;
      if (origStep) {
        posAnimProto._step = function (...args: any[]) {
          if (!this._el) return;
          try {
            return origStep.apply(this, args);
          } catch (err) {
            // Ignore animation step errors on removed elements
          }
        };
      }

      const origRun = posAnimProto.run;
      if (origRun) {
        posAnimProto.run = function (...args: any[]) {
          if (!this._el) return;
          try {
            return origRun.apply(this, args);
          } catch (err) {
            // Ignore
          }
        };
      }
    }

    // 6. Guard L.Draggable prototype
    const draggableProto = L.Draggable && (L.Draggable.prototype as any);
    if (draggableProto) {
      ['. _onDown', '_onMove', '_updatePosition'].forEach(method => {
        const cleanName = method.trim().replace('.', '');
        const origMethod = draggableProto[cleanName];
        if (origMethod) {
          draggableProto[cleanName] = function (...args: any[]) {
            if (!this._element) return;
            try {
              return origMethod.apply(this, args);
            } catch (err) {
              // Ignore
            }
          };
        }
      });
    }

    // 7. Guard L.Popup & L.Tooltip prototype _updatePosition
    [L.Popup, L.Tooltip].forEach(cls => {
      if (cls && cls.prototype) {
        const origUpdatePos = (cls.prototype as any)._updatePosition;
        if (origUpdatePos) {
          (cls.prototype as any)._updatePosition = function (...args: any[]) {
            if (!this._container || !this._map) return;
            try {
              return origUpdatePos.apply(this, args);
            } catch (err) {
              // Ignore
            }
          };
        }
      }
    });
  }
}

// Auto-run guard on module load
initLeafletPosGuard();


