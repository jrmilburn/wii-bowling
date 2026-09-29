`recorded-swing.json` contains numeric marker centres recovered locally from the
green tracking overlay in the user's second screen recording (29 September
2026). Rows are `[milliseconds, shoulder-left-x,y, shoulder-right-x,y,
hip-left-x,y, hip-right-x,y, elbow-right-x,y, wrist-right-x,y]`, unmirrored into
640×480 image coordinates. Only frames with all six markers recoverable are
included; their original timestamps and gaps are preserved. No photos or video
are included. Green markers are treated as visible; original confidence values
and world coordinates cannot be recovered from a screen recording.

This is a regression for the visible paused backswing at about 8 seconds. It
does not validate MediaPipe accuracy, missing frames, or a full live game. The
original game did not release; the updated detector releases at 8.4 seconds in
this offline replay. Synthetic tests separately cover tracking loss and unsafe
reacquisition.
