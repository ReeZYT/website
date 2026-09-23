# assets

Optional files. The site works without them.

| File        | What it does                                                                 |
| ----------- | ---------------------------------------------------------------------------- |
| `audio.mp3` | Background music. Starts on the visitor's first click or key press (browsers block autoplay with sound). Missing → no mute button. |

The profile picture is loaded from your Spotify profile (i.scdn.co). If you change your Spotify picture, its URL changes too:
copy the new image address from your Spotify profile and replace the `src` of `#avatar-img` in `index.html`.
If the image can't load, an "R" monogram is shown instead.
