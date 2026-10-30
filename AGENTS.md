Use `SifterLogo` for every product-brand placement and import its image from the repository so the logo file, homepage link, and accessibility remain consistent.
Never nest a form inside another form's React tree (a dialog opened from within a form counts) — the inner submit also fires the outer form's handler, so nested dialog forms call `stopPropagation()` on submit.
Password recovery links redirect to `/reset-password`, the only place a recovery session sets a password; that page must never send `current_password`, while signed-in password changes are a separate flow that does require it.
