/**
 * Makes a whole <tr> clickable without the CSS "stretched link" trick.
 * Safari does not treat `position: relative` on <tr> as a containing block, so an
 * `after:absolute after:inset-0` overlay escapes the row and covers the whole page
 * (every click ended on the same row's link). Keep a real <a> in the row for keyboard
 * and screen-reader users, and spread these props on the <tr>.
 */
const INTERACTIVE = 'a, button, input, select, textarea, label, summary, [role="menu"], [role="menuitem"]';

export function rowLinkProps(href) {
  const open = (event, newTab) => {
    if (event.target instanceof Element && event.target.closest(INTERACTIVE)) return;
    // Don't navigate when the user is selecting text in the row
    const selection = typeof window.getSelection === 'function' ? window.getSelection() : null;
    if (selection && selection.toString().length > 0) return;
    if (newTab) window.open(href, '_blank', 'noopener');
    else window.location.assign(href);
  };

  return {
    onClick: (event) => {
      if (event.button !== 0) return;
      open(event, event.metaKey || event.ctrlKey);
    },
    onAuxClick: (event) => {
      if (event.button === 1) open(event, true);
    },
  };
}
