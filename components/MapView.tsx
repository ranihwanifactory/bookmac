import React, { useEffect, useRef } from 'react';
import { Post } from '../types';

interface MapViewProps {
  posts: Post[];
}

declare global {
  interface Window {
    L: any;
  }
}

const MapView: React.FC<MapViewProps> = ({ posts }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);

  useEffect(() => {
    if (mapRef.current && !leafletMapRef.current && window.L) {
      // Default center (Korea)
      const map = window.L.map(mapRef.current).setView([36.5, 127.5], 7);

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      leafletMapRef.current = map;
    }

    if (leafletMapRef.current && window.L) {
      const map = leafletMapRef.current;
      
      // Clear existing markers (simplistic approach: remove all layers and re-add tiles/markers)
      // Better: keep track of marker layer group.
      map.eachLayer((layer: any) => {
        if (layer instanceof window.L.Marker) {
          map.removeLayer(layer);
        }
      });

      const markers: any[] = [];

      posts.forEach(post => {
        if (post.location) {
          const marker = window.L.marker([post.location.lat, post.location.lng])
            .addTo(map)
            .bindPopup(`
              <div style="width: 150px; text-align: center;">
                <img src="${post.coverImage}" style="width: 60px; height: auto; display: block; margin: 0 auto 5px; border-radius: 4px;" />
                <strong style="font-size: 12px; display: block; margin-bottom: 2px;">${post.bookTitle}</strong>
                <p style="font-size: 10px; color: #666; margin: 0;">${post.authorName}님</p>
                <p style="font-size: 10px; color: #888; margin-top: 2px;">${post.location.name}</p>
              </div>
            `);
          markers.push(marker);
        }
      });

      // Fit bounds if markers exist
      if (markers.length > 0) {
        const group = window.L.featureGroup(markers);
        map.fitBounds(group.getBounds(), { padding: [50, 50] });
      }
    }
  }, [posts]);

  return (
    <div className="w-full h-[500px] rounded-xl overflow-hidden shadow-sm border border-gray-200 z-0 relative">
      <div ref={mapRef} className="w-full h-full"></div>
    </div>
  );
};

export default MapView;