---
description: 'Performance optimization guidelines for React + Vite application'
applyTo: '**/*.{ts,tsx}'
---

# Performance Optimization Guidelines

## Bundle Size
- Use code splitting with React.lazy()
- Import only needed utilities from lodash (not full library)
- Monitor bundle size with Vite's build analysis
- Remove unused dependencies regularly

## Runtime Performance
- Use React.memo for expensive components
- Implement proper dependency arrays in useEffect/useMemo/useCallback
- Avoid creating objects/arrays in render
- Use useMemo for expensive computations
- Profile with React DevTools Profiler

## Rendering Optimization
- Keep component trees shallow
- Split large components into smaller ones
- Use CSS variables for theme switching (already in place)
- Minimize re-renders with proper state management

## IndexedDB Optimization
- Batch database operations when possible
- Use appropriate indexes on frequently queried fields
- Cache frequently accessed data
- Clean up old data periodically

## Image Optimization
- Use modern formats (WebP, AVIF) with fallbacks
- Implement lazy loading for images
- Optimize image sizes for different devices
