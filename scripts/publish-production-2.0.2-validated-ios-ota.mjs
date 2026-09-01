throw new Error(
  'Legacy iOS-only Production publisher disabled. Use scripts/eas-update-production.sh; '
  + 'shared releases require --platform all, while deliberate single-platform releases require '
  + '--release-scope platform-specific and --reason.',
);
