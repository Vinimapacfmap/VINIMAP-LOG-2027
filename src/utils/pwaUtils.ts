import vinimapLogo from '../assets/images/vinimap_app_logo_1785236008840.jpg';

/**
 * Dynamically updates document icons (<link rel="icon">, <link rel="apple-touch-icon">)
 * and generates a dynamic Web Application Manifest with the Sede (Hub) logo.
 * This guarantees that when the driver installs the app on their phone/device,
 * the home screen app icon uses the Sede logo as required.
 */
export function applyDynamicPwaManifestAndIcons(customLogoUrl?: string) {
  if (typeof document === 'undefined') return;

  const effectiveLogo = customLogoUrl || vinimapLogo;

  try {
    // 1. Update shortcut icon, icon, and apple-touch-icon in document head
    const iconSelectors = [
      'link[rel="shortcut icon"]',
      'link[rel="icon"]',
      'link[rel="apple-touch-icon"]'
    ];

    iconSelectors.forEach(selector => {
      const existingLinks = document.querySelectorAll(selector);
      existingLinks.forEach(link => {
        (link as HTMLLinkElement).href = effectiveLogo;
      });
    });

    // Ensure apple-touch-icon exists
    let appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement;
    if (!appleTouchIcon) {
      appleTouchIcon = document.createElement('link');
      appleTouchIcon.rel = 'apple-touch-icon';
      appleTouchIcon.sizes = '180x180';
      document.head.appendChild(appleTouchIcon);
    }
    appleTouchIcon.href = effectiveLogo;

    // Ensure standard icon exists
    let standardIcon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    if (!standardIcon) {
      standardIcon = document.createElement('link');
      standardIcon.rel = 'icon';
      standardIcon.type = 'image/png';
      document.head.appendChild(standardIcon);
    }
    standardIcon.href = effectiveLogo;

    // 2. Build dynamic PWA Manifest with mandatory Sede Logo for home screen icon
    const dynamicManifest = {
      id: "vinimap-condutor-app",
      short_name: "Vinimap Condutor",
      name: "Vinimap Logistics - App do Condutor",
      icons: [
        {
          src: effectiveLogo,
          type: effectiveLogo.startsWith('data:image/svg') ? "image/svg+xml" : "image/png",
          sizes: "192x192",
          purpose: "any maskable"
        },
        {
          src: effectiveLogo,
          type: effectiveLogo.startsWith('data:image/svg') ? "image/svg+xml" : "image/png",
          sizes: "512x512",
          purpose: "any maskable"
        }
      ],
      start_url: "/?view=driver_mobile",
      background_color: "#0f172a",
      theme_color: "#0f172a",
      display: "standalone",
      orientation: "portrait",
      categories: ["business", "logistics", "navigation"],
      prefer_related_applications: false,
      description: "Aplicativo oficial de logística para condutores e entregadores da Vinimap Logistics."
    };

    const stringManifest = JSON.stringify(dynamicManifest, null, 2);
    const blob = new Blob([stringManifest], { type: 'application/json' });
    const manifestUrl = URL.createObjectURL(blob);

    let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = manifestUrl;
  } catch (err) {
    console.warn('Não foi possível atualizar o manifesto PWA dinâmico:', err);
  }
}
