---
description: 'Accessibility standards for the personal learning assistant'
applyTo: '**/*.{ts,tsx}'
---

# Accessibility Standards - WCAG 2.1 AA

## Semantic HTML
- Use proper HTML elements: button, nav, main, section, article, aside
- Use heading hierarchy correctly (h1, h2, h3, etc.)
- Use lists for list content (ul, ol, li)
- Use labels for form inputs

## ARIA Attributes
- Use aria-label for icon-only buttons
- Use aria-describedby for detailed descriptions
- Use aria-live for dynamic content updates
- Use aria-hidden for decorative elements
- Use role attribute only when semantic HTML can't be used

## Keyboard Navigation
- All interactive elements must be keyboard accessible
- Tab order must be logical
- Implement proper focus management
- Provide visible focus indicators

## Color and Contrast
- Maintain at least 4.5:1 contrast ratio for text
- Don't use color alone to convey information
- Test with color blindness simulators
- Support light and dark themes

## Testing
- Use axe-core for automated accessibility testing
- Test with screen readers (NVDA, JAWS)
- Test with keyboard navigation only
- Include accessibility in manual testing
