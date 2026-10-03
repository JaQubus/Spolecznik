# StoryTile

Library item: a rounded photo with plain text beneath it. No frame, no border, no shadow; the photo is the shape.

Consumer provides: image (4:3, real `alt` when it carries information, otherwise empty `alt=""`), title link, one meta line (who it is for, where), one note (test count, rating, status), optional one badge on the image.

- Grid: 1 column, 2 from 560px, 3 from `bp-lg`. Gaps `space-5` / `space-6`.
- The whole tile is clickable through the title link's stretched `::after`; one link per tile, so screen readers hear one name. Focus ring wraps the tile.
- Badge on the image: a `hm-chip` on `surface`, at most one ("Nowość").
- Without a photo the media block shows `surface-sunken`; never stock photos of people.
- Use for browsing (Biblioteka). Match results use ResultList, which explains why each fits.
