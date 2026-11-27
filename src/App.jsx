import { useEffect, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import { verifyPremium, checkPremium, isPremiumConfigured } from './lib/premium.js'

// ---------------------------------------------------------------------------
// MemorialPrint — a blank-canvas memorial designer.
// A grieving family starts with a blank canvas and adds the pieces that
// made their loved one who they were: a photo, a name in a font they
// choose, and photo-realistic elements (never cartoons). One set of
// details feeds every output: poster, funeral program, invitation,
// keepsakes, and a t-shirt design.
// ---------------------------------------------------------------------------

const FONTS = {
  greatvibes: { name: 'Elegant Script', css: "'Great Vibes', cursive", premium: false },
  cormorant: { name: 'Classic Serif', css: "'Cormorant Garamond', serif", premium: false },
  playfair: { name: 'Formal Serif', css: "'Playfair Display', serif", premium: true },
  pinyon: { name: 'Flowing Script', css: "'Pinyon Script', cursive", premium: true },
  jost: { name: 'Clean Sans', css: "'Jost', sans-serif", premium: true },
}

const BACKGROUNDS = {
  white: { name: 'White', premium: false, dark: false, fill: '#FFFFFF' },
  cream: { name: 'Warm Cream', premium: false, dark: false, fill: '#FAF6EF' },
  grey: { name: 'Soft Grey', premium: true, dark: false, fill: '#E8E6E1' },
  dark: { name: 'Quiet Dark', premium: true, dark: true, fill: '#23272F' },
  sunset: { name: 'Gentle Sunset', premium: true, dark: false, gradient: ['#FDE9D9', '#F3C39B'] },
}

// Every element is a photograph, a photorealistic image, one of Paul's
// own hand-drawn pieces, or an image Paul supplied, stored locally in
// public/elements/. No cartoons, no clip art — the drawings are Paul's own
// pencil work, in the same classical style as the photos — see ATTRIBUTION.md.
//
// `mask` is how "Remove background" works for that photo. The photo's
// background is cut away by luminance, in the browser, with no API:
//   - { type: 'dark', lo, hi } — the background is dark: pixels darker
//     than `lo` become transparent, brighter than `hi` stay solid, with
//     a soft edge in between. For lilies, candlelight and angel wings
//     (bright subject on a dark background) this takes the background
//     clean away.
//   - { type: 'light', lo, hi } — the background is bright: pixels
//     brighter than `hi` become transparent, darker than `lo` stay
//     solid. For the rose heart and ribbon heart (dark-red subject on
//     white) this takes the white away clean, and for Paul's hand-drawn
//     pieces (dark pencil on white paper) it takes the paper away.
//   - null — the background cannot be separated from the subject by
//     brightness (white roses on cream, a dark cross against blue sky,
//     or a sunset, which is all scene and no subject), so the toggle is
//     greyed out for those photos rather than pretending.
// Blend modes were tried first and do NOT work here: on the app's light
// design backgrounds multiply changes almost nothing (the photo stays
// whole) and screen turns the whole photo into plain cream, subject
// included — verified on the real pixels before this was built.
const ELEMENTS = {
  dove: { name: 'Doves', src: '/elements/dove.jpg', premium: false, mask: { type: 'dark', lo: 0.45, hi: 0.68 } },
  cross: { name: 'Cross', src: '/elements/cross.jpg', premium: false, mask: null },
  roses: { name: 'White Roses', src: '/elements/roses.jpg', premium: true, mask: null },
  lilies: { name: 'White Lilies', src: '/elements/lilies.jpg', premium: true, mask: { type: 'dark', lo: 0.15, hi: 0.38 } },
  candle: { name: 'Candlelight', src: '/elements/candle.jpg', premium: true, mask: { type: 'dark', lo: 0.22, hi: 0.45 } },
  wings: { name: 'Angel Wings', src: '/elements/wings.jpg', premium: true, mask: { type: 'dark', lo: 0.28, hi: 0.50 } },
  sunset: { name: 'Sunset', src: '/elements/sunset.jpg', premium: true, mask: null },
  heart: { name: 'Rose Heart', src: '/elements/heart.jpg', premium: true, mask: { type: 'light', lo: 0.72, hi: 0.88 } },
  cherub: { name: 'Cherub', src: '/elements/cherub.jpg', premium: true, mask: { type: 'dark', lo: 0.45, hi: 0.68 } },
  ribbonHeart: { name: 'Ribbon Heart', src: '/elements/ribbon-heart.jpg', premium: true, ribbonText: true, mask: { type: 'light', lo: 0.58, hi: 0.80 } },
  cherubSketch: { name: 'Hand-Drawn Cherub', src: '/elements/cherub-sketch.jpg', premium: true, mask: { type: 'light', lo: 0.75, hi: 0.92 } },
  prayingCherub: { name: 'Praying Cherub & Roses', src: '/elements/praying-cherub.jpg', premium: true, mask: { type: 'light', lo: 0.72, hi: 0.90 } },
  prayingAngel: { name: 'Praying Angel', src: '/elements/praying-angel.jpg', premium: true, mask: { type: 'light', lo: 0.78, hi: 0.93 } },
  cherubPlaque: { name: 'Cherub & Heart Plaque', src: '/elements/cherub-plaque.jpg', premium: true, mask: { type: 'light', lo: 0.80, hi: 0.90 } },
  celticCross: { name: 'Celtic Cross', src: '/elements/celtic-cross.jpg', premium: true, mask: null },
  angelHeart: { name: 'Praying Angel & Heart', src: '/elements/angel-heart.jpg', premium: true, mask: null },
  stainedGlass: { name: 'Stained Glass Memory', src: '/elements/stained-glass.jpg', premium: true, mask: null },
  dovesMemory: { name: 'Doves & Memory Banner', src: '/elements/doves-memory.jpg', premium: true, mask: { type: 'light', lo: 0.85, hi: 0.93 } },
}

const OUTPUTS = {
  poster: { name: 'Poster · Wall Hanging', w: 1080, h: 1350, ratio: '4 / 5', premium: false, note: 'Prints 8×10 in' },
  program: { name: 'Funeral Program · Pamphlet', w: 1650, h: 2550, ratio: '11 / 17', premium: true, note: '4-page PDF, prints on letter paper' },
  invitation: { name: 'Service Invitation', w: 1080, h: 1350, ratio: '4 / 5', premium: true, note: 'Share or print' },
  keepsake: { name: 'Keepsake · Prayer Card', w: 1080, h: 1620, ratio: '2 / 3', premium: true, note: 'Prints 4×6 in' },
  tshirt: { name: 'T-Shirt Design', w: 1080, h: 1080, ratio: '1 / 1', premium: true, note: 'Print-ready design file' },
}

const VERSES = [
  'Forever in our hearts.',
  'Gone from our sight, but never from our hearts.',
  'Those we love don\u2019t go away — they walk beside us every day.',
  'In loving memory of a life beautifully lived.',
  'Always loved. Never forgotten.',
]

const DEFAULT_ORDER = [
  'Prelude — Music',
  'Welcome & Prayer',
  'Reading',
  'Eulogy',
  'Moment of Reflection',
  'Closing Prayer',
  'Benediction',
]

const DEFAULT_THANKYOU =
  'The family thanks you for your love, your prayers, and your presence today. Your support means more than words can say.'

const FREE_DAILY_LIMIT = 5
const DOWNLOADS_KEY = 'memorialprint_downloads'
const PAYMENT_LINK = import.meta.env.VITE_STRIPE_PAYMENT_LINK || ''
const PREMIUM_PRICE = '$2.99 once'

// ---------------------------------------------------------------------------
// Canvas helpers
// ---------------------------------------------------------------------------

// Cut a photo's background away by brightness, in the browser.
// Returns an offscreen canvas with the same picture but transparent
// where the background was, or null if it cannot be done. The masked
// canvas draws exactly like the photo, so the preview and every export
// use the same image and what you see is what prints.
function smoothstep(x, lo, hi) {
  const t = Math.max(0, Math.min(1, (x - lo) / (hi - lo)))
  return t * t * (3 - 2 * t)
}

function makeMaskedImage(img, mask) {
  try {
    const c = document.createElement('canvas')
    c.width = img.naturalWidth || img.width
    c.height = img.naturalHeight || img.height
    const ctx = c.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const imageData = ctx.getImageData(0, 0, c.width, c.height)
    const px = imageData.data
    for (let i = 0; i < px.length; i += 4) {
      const lum = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255
      const a = mask.type === 'dark'
        ? smoothstep(lum, mask.lo, mask.hi)
        : 1 - smoothstep(lum, mask.lo, mask.hi)
      px[i + 3] = Math.round(a * 255)
    }
    ctx.putImageData(imageData, 0, 0)
    return c
  } catch {
    return null
  }
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

function drawCover(ctx, img, x, y, w, h, zoom, pan) {
  const ir = img.width / img.height
  const cr = w / h
  let dw, dh
  if (ir > cr) { dh = h; dw = h * ir } else { dw = w; dh = w / ir }
  dw *= zoom; dh *= zoom
  const dx = x + (w - dw) / 2 + (pan.x || 0) * w
  const dy = y + (h - dh) / 2 + (pan.y || 0) * h
  ctx.drawImage(img, dx, dy, dw, dh)
}

function drawContain(ctx, img, x, y, w, h, zoom, pan) {
  const ir = img.width / img.height
  const cr = w / h
  let dw, dh
  if (ir > cr) { dw = w; dh = w / ir } else { dh = h; dw = h * ir }
  dw *= zoom; dh *= zoom
  const dx = x + (w - dw) / 2 + (pan.x || 0) * w
  const dy = y + (h - dh) / 2 + (pan.y || 0) * h
  ctx.drawImage(img, dx, dy, dw, dh)
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/)
  const lines = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

function drawLines(ctx, lines, cx, y, lineHeight, maxWidth) {
  lines.forEach((ln, i) => ctx.fillText(ln, cx, y + i * lineHeight, maxWidth))
}

// Draw the loved one's photo inside an arch / oval / rectangle frame.
function drawPhotoFramed(ctx, img, x, y, w, h, frame, fitMode, zoom, pan) {
  ctx.save()
  if (frame === 'oval') {
    ctx.beginPath()
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
    ctx.clip()
  } else if (frame === 'arch') {
    const r = w / 2
    ctx.beginPath()
    ctx.moveTo(x, y + h)
    ctx.lineTo(x, y + r)
    ctx.arc(x + w / 2, y + r, r, Math.PI, 0)
    ctx.lineTo(x + w, y + h)
    ctx.closePath()
    ctx.clip()
  } else {
    rr(ctx, x, y, w, h, Math.min(w, h) * 0.03)
    ctx.clip()
  }
  if (fitMode === 'fit') {
    ctx.save()
    try { ctx.filter = 'blur(24px)' } catch { /* older browsers ignore */ }
    drawCover(ctx, img, x, y, w, h, 1.1, { x: 0, y: 0 })
    ctx.restore()
    drawContain(ctx, img, x, y, w, h, zoom, pan)
  } else {
    drawCover(ctx, img, x, y, w, h, zoom, pan)
  }
  ctx.restore()
  // Thin gold frame line
  ctx.save()
  ctx.strokeStyle = 'rgba(138, 109, 59, 0.65)'
  ctx.lineWidth = Math.max(2, w * 0.006)
  if (frame === 'oval') {
    ctx.beginPath()
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
    ctx.stroke()
  } else if (frame === 'arch') {
    const r = w / 2
    ctx.beginPath()
    ctx.moveTo(x, y + h)
    ctx.lineTo(x, y + r)
    ctx.arc(x + w / 2, y + r, r, Math.PI, 0)
    ctx.lineTo(x + w, y + h)
    ctx.closePath()
    ctx.stroke()
  } else {
    rr(ctx, x, y, w, h, Math.min(w, h) * 0.03)
    ctx.stroke()
  }
  ctx.restore()
}

// Draw one placed photo element as a small framed tile.
// When `hideBg` is set, the image passed in is already the background-
// removed version: no white tile, shadow or border — just the subject,
// drawn straight onto the design behind it.
function drawElementTile(ctx, img, x, y, w, h, hideBg) {
  if (hideBg) {
    ctx.save()
    rr(ctx, x, y, w, h, w * 0.05)
    ctx.clip()
    drawCover(ctx, img, x, y, w, h, 1, { x: 0, y: 0 })
    ctx.restore()
    return
  }
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.25)'
  ctx.shadowBlur = w * 0.08
  ctx.shadowOffsetY = w * 0.02
  rr(ctx, x, y, w, h, w * 0.05)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()
  ctx.restore()
  ctx.save()
  rr(ctx, x, y, w, h, w * 0.05)
  ctx.clip()
  drawCover(ctx, img, x, y, w, h, 1, { x: 0, y: 0 })
  ctx.restore()
  ctx.save()
  rr(ctx, x, y, w, h, w * 0.05)
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = Math.max(2, w * 0.012)
  ctx.stroke()
  ctx.restore()
}

// ---------------------------------------------------------------------------
// The one renderer: draws every output variant. Used for the live preview
// canvas and for the high-resolution downloads, so what you see is what
// prints.
// ---------------------------------------------------------------------------
function renderDesign(ctx, W, H, variant, d) {
  const bg = BACKGROUNDS[d.bgKey] || BACKGROUNDS.cream
  if (bg.gradient) {
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, bg.gradient[0])
    g.addColorStop(1, bg.gradient[1])
    ctx.fillStyle = g
  } else {
    ctx.fillStyle = bg.fill
  }
  ctx.fillRect(0, 0, W, H)

  const dark = bg.dark
  const ink = dark ? '#F5F1EA' : '#334155'
  const soft = dark ? '#D6D0C4' : '#5B6572'
  const gold = dark ? '#D9C08A' : '#8A6D3B'
  const cx = W / 2
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const name = (d.name || '').trim()
  const dates = [d.birthDate, d.deathDate].filter((s) => (s || '').trim()).join('  —  ')
  const message = (d.message || '').trim()
  const hasPhoto = Boolean(d.photoImg)

  function drawPlacedElements(scale = 1) {
    ;(d.placed || []).forEach((p) => {
      if (p.kind === 'text') {
        // Ribbon words: their own draggable piece, drawn in elegant script.
        const text = (p.text || '').trim()
        if (!text) return
        const w = p.w * W * scale
        const size = Math.max(10, w * 0.13)
        const cx = p.x * W
        const cy = p.y * H
        ctx.save()
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = `600 ${size}px 'Great Vibes', cursive`
        const lines = wrapText(ctx, text, w * 1.1).slice(0, 2)
        ctx.lineWidth = size * 0.16
        ctx.lineJoin = 'round'
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'
        ctx.fillStyle = '#43302B'
        lines.forEach((ln, i) => {
          const y = cy + (i - (lines.length - 1) / 2) * size * 1.05
          ctx.strokeText(ln, cx, y, w * 1.1)
          ctx.fillText(ln, cx, y, w * 1.1)
        })
        ctx.restore()
        return
      }
      const el = ELEMENTS[p.id]
      // With "Remove background" on, draw the background-removed version
      // of the photo; if there is none (this photo cannot be separated),
      // fall back to the full photo in its tile.
      const masked = p.hideBg ? d.elementMasked[p.id] : null
      const img = masked || d.elementImgs[p.id]
      if (!img) return
      const w = p.w * W * scale
      const h = w * 0.75
      const x = p.x * W - w / 2
      const y = p.y * H - h / 2
      // hideBg defaults to off (older designs have no such field), so
      // existing designs do not change.
      drawElementTile(ctx, img, x, y, w, h, Boolean(masked))
    })
  }

  function drawNameBlock(yName, nameSize, datesSize, msgSize, msgMaxLines) {
    if (name) {
      ctx.fillStyle = ink
      ctx.font = `600 ${nameSize}px ${FONTS[d.fontKey].css}`
      const lines = wrapText(ctx, name, W * 0.86)
      drawLines(ctx, lines.slice(0, 2), cx, yName, nameSize * 1.05, W * 0.86)
      return yName + nameSize * 1.05 * Math.min(2, lines.length)
    }
    return yName
  }

  function drawDivider(y) {
    const dw = W * 0.18
    ctx.strokeStyle = gold
    ctx.lineWidth = Math.max(2, W * 0.0025)
    ctx.beginPath()
    ctx.moveTo(cx - dw / 2, y)
    ctx.lineTo(cx + dw / 2, y)
    ctx.stroke()
    ctx.fillStyle = gold
    ctx.beginPath()
    ctx.arc(cx, y, Math.max(3, W * 0.004), 0, Math.PI * 2)
    ctx.fill()
  }

  function drawHeading(text, y, size, color, spacing) {
    ctx.fillStyle = color || gold
    ctx.font = `600 ${size}px ${FONTS.cormorant.css}`
    ctx.fillText(text, cx, y, W * 0.88)
  }

  if (variant === 'poster' || variant === 'cover') {
    // Heading
    drawHeading('I N   L O V I N G   M E M O R Y', H * 0.062, Math.round(W * 0.028), gold)
    // Photo
    if (hasPhoto) {
      const pw = W * 0.56
      const ph = H * 0.5
      drawPhotoFramed(ctx, d.photoImg, cx - pw / 2, H * 0.095, pw, ph, d.photoFrame, d.photoFit, d.photoZoom, d.photoPan)
    } else {
      ctx.fillStyle = soft
      ctx.font = `${Math.round(W * 0.2)}px serif`
      ctx.fillText('🕊️', cx, H * 0.32)
      ctx.font = `500 ${Math.round(W * 0.032)}px ${FONTS.cormorant.css}`
      ctx.fillText('Add their photo to begin', cx, H * 0.44)
    }
    // Name + dates + message
    let y = drawNameBlock(H * 0.645, Math.round(W * 0.068), 0, 0, 0)
    if (dates) {
      ctx.fillStyle = soft
      ctx.font = `500 ${Math.round(W * 0.032)}px ${FONTS.cormorant.css}`
      ctx.fillText(dates, cx, y + H * 0.032, W * 0.86)
      y += H * 0.032
    }
    drawDivider(y + H * 0.028)
    if (message) {
      ctx.fillStyle = ink
      ctx.font = `italic 500 ${Math.round(W * 0.034)}px ${FONTS.cormorant.css}`
      const lines = wrapText(ctx, message, W * 0.8).slice(0, 3)
      drawLines(ctx, lines, cx, y + H * 0.075, Math.round(W * 0.034) * 1.35, W * 0.8)
    }
    drawPlacedElements(1)
    if (variant === 'cover') {
      ctx.fillStyle = soft
      ctx.font = `500 ${Math.round(W * 0.02)}px ${FONTS.cormorant.css}`
      ctx.fillText('A service of remembrance', cx, H * 0.965, W * 0.86)
    }
  } else if (variant === 'order') {
    drawHeading('Order of Service', H * 0.08, Math.round(W * 0.05), ink)
    if (d.serviceDate || d.serviceTime || d.serviceLocation) {
      ctx.fillStyle = soft
      ctx.font = `500 ${Math.round(W * 0.026)}px ${FONTS.cormorant.css}`
      const bits = [d.serviceDate, d.serviceTime, d.serviceLocation].filter((s) => (s || '').trim())
      ctx.fillText(bits.join('  ·  '), cx, H * 0.125, W * 0.86)
    }
    drawDivider(H * 0.16)
    ctx.fillStyle = ink
    ctx.font = `500 ${Math.round(W * 0.032)}px ${FONTS.cormorant.css}`
    const lines = (d.orderLines || []).filter((s) => (s || '').trim())
    drawLines(ctx, lines, cx, H * 0.21, Math.round(W * 0.032) * 1.9, W * 0.84)
    ctx.fillStyle = soft
    ctx.font = `italic 500 ${Math.round(W * 0.028)}px ${FONTS.cormorant.css}`
    ctx.fillText('All are welcome.', cx, H * 0.88, W * 0.86)
  } else if (variant === 'obituary') {
    drawHeading('A Life Remembered', H * 0.08, Math.round(W * 0.05), ink)
    drawDivider(H * 0.115)
    if (hasPhoto) {
      const pw = W * 0.4
      const ph = H * 0.22
      drawPhotoFramed(ctx, d.photoImg, cx - pw / 2, H * 0.15, pw, ph, 'rect', d.photoFit, 1, { x: 0, y: 0 })
    }
    const obit = (d.obituary || '').trim()
    ctx.fillStyle = ink
    ctx.textAlign = 'left'
    ctx.font = `500 ${Math.round(W * 0.03)}px ${FONTS.cormorant.css}`
    const startY = hasPhoto ? H * 0.4 : H * 0.16
    const obitLines = obit ? wrapText(ctx, obit, W * 0.8).slice(0, 14) : ['A few words about their life…']
    if (!obit) ctx.fillStyle = soft
    drawLines(ctx, obitLines, W * 0.1, startY, Math.round(W * 0.03) * 1.6, W * 0.8)
    ctx.textAlign = 'center'
    const poem = (d.poem || '').trim()
    if (poem) {
      const py = startY + obitLines.length * Math.round(W * 0.03) * 1.6 + H * 0.05
      ctx.fillStyle = gold
      ctx.font = `italic 500 ${Math.round(W * 0.032)}px ${FONTS.cormorant.css}`
      const poemLines = wrapText(ctx, poem, W * 0.76).slice(0, 4)
      drawLines(ctx, poemLines, cx, py, Math.round(W * 0.032) * 1.4, W * 0.76)
    }
  } else if (variant === 'back') {
    drawHeading('Thank You', H * 0.08, Math.round(W * 0.05), ink)
    drawDivider(H * 0.115)
    ctx.fillStyle = ink
    ctx.font = `500 ${Math.round(W * 0.03)}px ${FONTS.cormorant.css}`
    const lines = wrapText(ctx, d.thankYou || DEFAULT_THANKYOU, W * 0.78).slice(0, 10)
    ctx.textAlign = 'center'
    drawLines(ctx, lines, cx, H * 0.17, Math.round(W * 0.03) * 1.7, W * 0.78)
    if (name) {
      ctx.fillStyle = soft
      ctx.font = `600 ${Math.round(W * 0.03)}px ${FONTS[d.fontKey].css}`
      ctx.fillText(`— The family of ${name} —`, cx, H * 0.17 + lines.length * Math.round(W * 0.03) * 1.7 + H * 0.04, W * 0.86)
    }
    ctx.font = `${Math.round(W * 0.09)}px serif`
    ctx.fillText('🕊️', cx, H * 0.8)
    ctx.fillStyle = soft
    ctx.font = `500 ${Math.round(W * 0.022)}px ${FONTS.cormorant.css}`
    ctx.fillText('Made with MemorialPrint', cx, H * 0.93, W * 0.86)
  } else if (variant === 'invitation') {
    drawHeading('You are warmly invited to', H * 0.07, Math.round(W * 0.03), soft)
    ctx.fillStyle = ink
    ctx.font = `600 ${Math.round(W * 0.05)}px ${FONTS.cormorant.css}`
    ctx.fillText('A Celebration of Life', cx, H * 0.115, W * 0.9)
    if (hasPhoto) {
      const pw = W * 0.46
      const ph = H * 0.34
      drawPhotoFramed(ctx, d.photoImg, cx - pw / 2, H * 0.16, pw, ph, d.photoFrame, d.photoFit, d.photoZoom, d.photoPan)
    }
    let y = drawNameBlock(H * 0.56, Math.round(W * 0.064), 0, 0, 0)
    if (dates) {
      ctx.fillStyle = soft
      ctx.font = `500 ${Math.round(W * 0.032)}px ${FONTS.cormorant.css}`
      ctx.fillText(dates, cx, y + H * 0.032, W * 0.86)
      y += H * 0.032
    }
    drawDivider(y + H * 0.028)
    const bits = [d.serviceDate, d.serviceTime, d.serviceLocation].filter((s) => (s || '').trim())
    ctx.fillStyle = ink
    ctx.font = `500 ${Math.round(W * 0.032)}px ${FONTS.cormorant.css}`
    drawLines(ctx, bits, cx, y + H * 0.075, Math.round(W * 0.032) * 1.5, W * 0.84)
    ctx.fillStyle = soft
    ctx.font = `italic 500 ${Math.round(W * 0.03)}px ${FONTS.cormorant.css}`
    ctx.fillText('All are welcome. Please join us in remembering a life well lived.', cx, H * 0.9, W * 0.84)
  } else if (variant === 'keepsake') {
    ctx.strokeStyle = gold
    ctx.lineWidth = Math.max(2, W * 0.003)
    rr(ctx, W * 0.05, H * 0.03, W * 0.9, H * 0.94, W * 0.02)
    ctx.stroke()
    drawHeading('I N   L O V I N G   M E M O R Y', H * 0.07, Math.round(W * 0.026), gold)
    if (hasPhoto) {
      const pw = W * 0.52
      const ph = H * 0.3
      drawPhotoFramed(ctx, d.photoImg, cx - pw / 2, H * 0.1, pw, ph, d.photoFrame, d.photoFit, d.photoZoom, d.photoPan)
    }
    let y = drawNameBlock(H * 0.47, Math.round(W * 0.06), 0, 0, 0)
    if (dates) {
      ctx.fillStyle = soft
      ctx.font = `500 ${Math.round(W * 0.03)}px ${FONTS.cormorant.css}`
      ctx.fillText(dates, cx, y + H * 0.028, W * 0.86)
      y += H * 0.028
    }
    drawDivider(y + H * 0.022)
    if (message) {
      ctx.fillStyle = ink
      ctx.font = `italic 500 ${Math.round(W * 0.032)}px ${FONTS.cormorant.css}`
      const lines = wrapText(ctx, message, W * 0.76).slice(0, 3)
      drawLines(ctx, lines, cx, y + H * 0.06, Math.round(W * 0.032) * 1.4, W * 0.76)
    }
    ctx.font = `${Math.round(W * 0.07)}px serif`
    ctx.fillText('🕊️', cx, H * 0.88)
  } else if (variant === 'tshirt') {
    ctx.fillStyle = '#23272F'
    ctx.fillRect(0, 0, W, H)
    const inkD = '#F5F1EA'
    const softD = '#D6D0C4'
    const goldD = '#D9C08A'
    if (hasPhoto) {
      const pw = W * 0.52
      const ph = H * 0.42
      drawPhotoFramed(ctx, d.photoImg, cx - pw / 2, H * 0.1, pw, ph, 'oval', d.photoFit, d.photoZoom, d.photoPan)
    }
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    if (name) {
      ctx.fillStyle = inkD
      ctx.font = `600 ${Math.round(W * 0.07)}px ${FONTS[d.fontKey].css}`
      const lines = wrapText(ctx, name, W * 0.86)
      drawLines(ctx, lines.slice(0, 2), cx, H * 0.6, Math.round(W * 0.07) * 1.05, W * 0.86)
    }
    if (dates) {
      ctx.fillStyle = softD
      ctx.font = `500 ${Math.round(W * 0.03)}px ${FONTS.cormorant.css}`
      ctx.fillText(dates, cx, H * 0.72, W * 0.86)
    }
    ctx.fillStyle = goldD
    ctx.font = `600 ${Math.round(W * 0.026)}px ${FONTS.cormorant.css}`
    ctx.fillText('I N   L O V I N G   M E M O R Y', cx, H * 0.8, W * 0.88)
    drawPlacedElements(1)
  }

  // Free footer on the poster (not on paid outputs' inner pages)
  if (!d.premium && (variant === 'poster' || variant === 'invitation' || variant === 'keepsake')) {
    ctx.fillStyle = dark ? 'rgba(245,241,234,0.75)' : 'rgba(51,65,85,0.6)'
    ctx.font = `600 ${Math.round(W * 0.018)}px Jost, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText('Made with MemorialPrint', cx, H - Math.round(W * 0.018), W * 0.86)
  }
}

const FAQS = [
  { q: 'Is MemorialPrint really free?', a: 'Yes — making a memorial poster is free, with two photo elements, two elegant fonts, and 5 downloads a day. Premium is a one-time $2.99 and unlocks every element, every font, and every output: the funeral program, the invitation, the keepsakes, and the t-shirt design.' },
  { q: 'Can I remove the background from a piece?', a: 'Yes, for most pieces — tap one you added, then tick “Remove background”. The photo background melts away so just the subject shows, on the poster and on every download. It works best where the background is plain: a dark background behind lilies, a candle or angel wings, or a white background behind a rose heart or ribbon heart. A few photos can’t be separated from their background (white roses, the cross, the sunset), so the tick box is greyed out for those.' },
  { q: 'Does my loved one\u2019s photo leave my device?', a: 'No. Your photo is processed right in your browser and never uploaded anywhere. Nothing you make is stored on a server.' },
  { q: 'What can I make with it?', a: 'A wall poster to hang at home, a funeral program pamphlet to hand out at the service, an invitation to the service, and celebration-of-life keepsakes like prayer cards. The same design can also be used on a t-shirt.' },
  { q: 'What is in a funeral program?', a: 'A folded pamphlet: a cover with their photo, name and dates, inside pages for the order of service and an obituary or poem, and a back page with a thank-you note. It downloads as a print-ready PDF.' },
  { q: 'Can I print it at home?', a: 'Yes — downloads are high-resolution PNGs and a print-ready PDF, so they print cleanly at home or at a print shop.' },
  { q: 'How does Premium work?', a: 'Tap Get Premium and pay $2.99 once. You come straight back to the app and Premium unlocks in this browser. There is no subscription and no account to create.' },
]

export default function App() {
  const [photo, setPhoto] = useState(null) // data URL
  const [photoName, setPhotoName] = useState('')
  const [photoZoom, setPhotoZoom] = useState(1)
  const [photoPan, setPhotoPan] = useState({ x: 0, y: 0 })
  const [photoFit, setPhotoFit] = useState('fit')
  const [photoFrame, setPhotoFrame] = useState('arch')
  const [name, setName] = useState('')
  const [fontKey, setFontKey] = useState('cormorant')
  const [birthDate, setBirthDate] = useState('')
  const [deathDate, setDeathDate] = useState('')
  const [message, setMessage] = useState('Forever in our hearts.')
  const [serviceDate, setServiceDate] = useState('')
  const [serviceTime, setServiceTime] = useState('')
  const [serviceLocation, setServiceLocation] = useState('')
  const [placed, setPlaced] = useState([])
  const [selectedUid, setSelectedUid] = useState(null)
  const [bgKey, setBgKey] = useState('cream')
  const [outputKey, setOutputKey] = useState('poster')
  const [programPage, setProgramPage] = useState(0)
  const [orderLines, setOrderLines] = useState(DEFAULT_ORDER)
  const [obituary, setObituary] = useState('')
  const [poem, setPoem] = useState('Gone from our sight, but never from our hearts.')
  const [thankYou, setThankYou] = useState(DEFAULT_THANKYOU)
  const [premium, setPremium] = useState(false)
  const [usedToday, setUsedToday] = useState(() => downloadsUsedToday())
  const [toast, setToast] = useState('')
  const [exporting, setExporting] = useState(false)
  const fileRef = useRef(null)
  const previewRef = useRef(null)
  const previewBoxRef = useRef(null)
  const dragRef = useRef(null)
  const elementImgsRef = useRef({})
  const elementMaskedRef = useRef({}) // background-removed versions, built once at load
  const photoImgRef = useRef(null)

  const bg = BACKGROUNDS[bgKey]
  const output = OUTPUTS[outputKey]
  const selected = placed.find((p) => p.uid === selectedUid) || null

  // ---- premium: verify a returning payment, then check the stored token
  useEffect(() => {
    let cancelled = false
    async function init() {
      const params = new URLSearchParams(window.location.search)
      const sessionId = params.get('session_id')
      if (sessionId) {
        const ok = await verifyPremium(sessionId)
        if (!cancelled && ok) {
          setPremium(true)
          showToast('Welcome to Premium — everything is unlocked.')
          window.history.replaceState({}, '', window.location.pathname)
          return
        }
        if (!cancelled) showToast('Payment received — Premium is still confirming. Reload in a moment.')
      }
      const has = await checkPremium()
      if (!cancelled && has) setPremium(true)
    }
    init()
    return () => { cancelled = true }
  }, [])

  // ---- preload the element photos once (same-origin, so exports stay clean)
  // Photos with a mask also get a background-removed version, built once
  // here so the preview and every export share it.
  useEffect(() => {
    let cancelled = false
    Promise.all(Object.entries(ELEMENTS).map(async ([id, el]) => {
      const img = await loadImage(el.src)
      if (cancelled || !img) return
      elementImgsRef.current[id] = img
      if (el.mask) {
        const masked = makeMaskedImage(img, el.mask)
        if (masked) elementMaskedRef.current[id] = masked
      }
    })).then(() => { if (!cancelled) drawPreview() })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- load the uploaded photo into an image for canvas use
  useEffect(() => {
    if (!photo) { photoImgRef.current = null; drawPreview(); return }
    let cancelled = false
    loadImage(photo).then((img) => {
      if (!cancelled) { photoImgRef.current = img; drawPreview() }
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo])

  // ---- redraw the live preview whenever anything changes
  useEffect(() => {
    drawPreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo, photoZoom, photoPan, photoFit, photoFrame, name, fontKey, birthDate, deathDate, message, serviceDate, serviceTime, serviceLocation, placed, bgKey, outputKey, programPage, orderLines, obituary, poem, thankYou, premium])

  function showToast(text) {
    setToast(text)
    setTimeout(() => setToast(''), 5000)
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10)
  }

  function downloadsUsedToday() {
    try {
      const raw = JSON.parse(localStorage.getItem(DOWNLOADS_KEY) || '{}')
      return raw.date === todayKey() ? (raw.count || 0) : 0
    } catch {
      return 0
    }
  }

  function recordDownload() {
    const raw = { date: todayKey(), count: downloadsUsedToday() + 1 }
    try { localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(raw)) } catch { /* ignore */ }
    return raw.count
  }

  function designData() {
    return {
      photoImg: photoImgRef.current,
      elementImgs: elementImgsRef.current,
      elementMasked: elementMaskedRef.current,
      name, fontKey, birthDate, deathDate, message,
      serviceDate, serviceTime, serviceLocation,
      placed, bgKey, photoFrame, photoFit, photoZoom, photoPan,
      orderLines, obituary, poem, thankYou,
      premium,
    }
  }

  function currentVariant() {
    if (outputKey === 'program') return ['cover', 'order', 'obituary', 'back'][programPage]
    return outputKey
  }

  function drawPreview() {
    const canvas = previewRef.current
    if (!canvas) return
    const variant = currentVariant()
    const dims = outputKey === 'program'
      ? { w: 1650, h: 2550 }
      : { w: OUTPUTS[outputKey].w, h: OUTPUTS[outputKey].h }
    const scale = Math.min(560 / dims.w, 640 / dims.h)
    canvas.width = Math.round(dims.w * scale)
    canvas.height = Math.round(dims.h * scale)
    const ctx = canvas.getContext('2d')
    ctx.scale(scale, scale)
    const d = designData()
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        const c2 = previewRef.current
        if (!c2) return
        const ctx2 = c2.getContext('2d')
        ctx2.setTransform(scale, 0, 0, scale, 0, 0)
        renderDesign(ctx2, dims.w, dims.h, variant, d)
      })
    }
    renderDesign(ctx, dims.w, dims.h, variant, d)
  }

  function handleUpgrade() {
    if (!PAYMENT_LINK) {
      showToast('Premium checkout is being set up — check back soon.')
      return
    }
    window.open(PAYMENT_LINK, '_blank')
  }

  function pickFont(key) {
    if (FONTS[key].premium && !premium) {
      showToast(`${FONTS[key].name} is a Premium font — ${PREMIUM_PRICE} unlocks it.`)
      return
    }
    setFontKey(key)
  }

  function pickBackground(key) {
    if (BACKGROUNDS[key].premium && !premium) {
      showToast(`${BACKGROUNDS[key].name} is a Premium background — ${PREMIUM_PRICE} unlocks it.`)
      return
    }
    setBgKey(key)
  }

  function pickOutput(key) {
    if (OUTPUTS[key].premium && !premium) {
      showToast(`${OUTPUTS[key].name} is Premium — ${PREMIUM_PRICE} unlocks every output.`)
      return
    }
    setOutputKey(key)
    setProgramPage(0)
  }

  function addElement(id) {
    const el = ELEMENTS[id]
    if (el.premium && !premium) {
      showToast(`${el.name} is a Premium element — ${PREMIUM_PRICE} unlocks them all.`)
      return
    }
    const freeCap = premium ? 4 : 2
    const imageCount = placed.filter((p) => p.kind !== 'text').length
    if (imageCount >= freeCap) {
      showToast(premium ? 'Up to 4 pieces on a canvas.' : `Free adds up to 2 pieces — ${PREMIUM_PRICE} unlocks 4.`)
      return
    }
    const spots = [
      { x: 0.16, y: 0.78 }, { x: 0.84, y: 0.78 },
      { x: 0.16, y: 0.2 }, { x: 0.84, y: 0.2 },
    ]
    const spot = spots[imageCount % spots.length]
    const uid = `${id}-${Date.now()}`
    const items = [{ uid, id, x: spot.x, y: spot.y, w: 0.22, hideBg: false }]
    let selectUid = uid
    if (el.ribbonText) {
      // The ribbon words are their own piece: they start on the ribbon,
      // but the user can drag them anywhere on the design.
      const textUid = `ribbonwords-${Date.now()}`
      items.push({ uid: textUid, kind: 'text', id: 'ribbonText', x: spot.x, y: spot.y, w: 0.22, text: name.trim(), pairUid: uid })
      selectUid = textUid
      if (!name.trim()) {
        showToast('Tap the ribbon words and type their name — they can sit on the ribbon or anywhere you like.')
      }
    }
    setPlaced((prev) => [...prev, ...items])
    setSelectedUid(selectUid)
  }

  function removeElement(uid) {
    const sel = placed.find((p) => p.uid === selectedUid)
    // Removing a picture also removes its paired ribbon words.
    setPlaced((prev) => prev.filter((p) => p.uid !== uid && p.pairUid !== uid))
    if (selectedUid === uid || (sel && sel.pairUid === uid)) setSelectedUid(null)
  }

  function updateSelected(w) {
    if (!selectedUid) return
    setPlaced((prev) => prev.map((p) => (p.uid === selectedUid ? { ...p, w } : p)))
  }

  // "Remove background" is free for everyone — a designer feature, not
  // a new element, so it is never gated behind Premium.
  function toggleSelectedHideBg() {
    if (!selectedUid) return
    setPlaced((prev) => prev.map((p) => (p.uid === selectedUid ? { ...p, hideBg: !p.hideBg } : p)))
  }

  function updateSelectedText(text) {
    if (!selectedUid) return
    setPlaced((prev) => prev.map((p) => (p.uid === selectedUid ? { ...p, text } : p)))
  }

  function onPhotoFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      setPhoto(e.target.result)
      setPhotoName(file.name)
      setPhotoZoom(1)
      setPhotoPan({ x: 0, y: 0 })
    }
    reader.readAsDataURL(file)
  }

  // ---- dragging placed elements on the preview
  function onElementPointerDown(e, uid) {
    e.stopPropagation()
    setSelectedUid(uid)
    const box = previewBoxRef.current
    if (!box) return
    const rect = box.getBoundingClientRect()
    const p = placed.find((x) => x.uid === uid)
    dragRef.current = { kind: 'element', uid, startX: e.clientX, startY: e.clientY, x: p.x, y: p.y, rect }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPreviewPointerDown(e) {
    if (!photo) return
    const box = previewBoxRef.current
    if (!box) return
    const rect = box.getBoundingClientRect()
    dragRef.current = { kind: 'photo', startX: e.clientX, startY: e.clientY, panX: photoPan.x, panY: photoPan.y, rect }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPreviewPointerMove(e) {
    const drag = dragRef.current
    if (!drag) return
    const dx = (e.clientX - drag.startX) / drag.rect.width
    const dy = (e.clientY - drag.startY) / drag.rect.height
    if (drag.kind === 'element') {
      setPlaced((prev) => prev.map((p) => (p.uid === drag.uid
        ? { ...p, x: Math.max(0.08, Math.min(0.92, drag.x + dx)), y: Math.max(0.06, Math.min(0.94, drag.y + dy)) }
        : p)))
    } else {
      setPhotoPan({
        x: Math.max(-0.5, Math.min(0.5, drag.panX + dx)),
        y: Math.max(-0.5, Math.min(0.5, drag.panY + dy)),
      })
    }
  }

  function onPreviewPointerUp() {
    dragRef.current = null
  }

  // ---- downloads
  async function renderToCanvas(variant, w, h) {
    await document.fonts.ready.catch(() => {})
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    renderDesign(ctx, w, h, variant, designData())
    return canvas
  }

  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  async function downloadCurrent() {
    if (exporting) return
    if (!premium && usedToday >= FREE_DAILY_LIMIT) {
      showToast(`Free limit reached — 5 downloads a day. Premium (${PREMIUM_PRICE}) is unlimited.`)
      return
    }
    setExporting(true)
    try {
      if (outputKey === 'program') {
        await downloadProgramPdf()
      } else {
        const canvas = await renderToCanvas(currentVariant(), output.w, output.h)
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
        if (!blob) throw new Error('no blob')
        saveBlob(blob, `memorialprint-${outputKey}-${Date.now()}.png`)
        afterDownload(`Your ${output.name.toLowerCase()} is downloaded.`)
      }
    } catch {
      showToast('Something went wrong making your download — please try again.')
      setExporting(false)
    }
  }

  async function downloadProgramPdf() {
    const variants = ['cover', 'order', 'obituary', 'back']
    const doc = new jsPDF({ unit: 'in', format: [5.5, 8.5], orientation: 'portrait' })
    for (let i = 0; i < variants.length; i++) {
      const canvas = await renderToCanvas(variants[i], 1650, 2550)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
      if (i > 0) doc.addPage([5.5, 8.5], 'portrait')
      doc.addImage(dataUrl, 'JPEG', 0, 0, 5.5, 8.5)
    }
    doc.save(`memorialprint-program-${Date.now()}.pdf`)
    afterDownload('Your funeral program is downloaded — print it on letter paper and fold it in half.')
  }

  function afterDownload(msg) {
    if (!premium) setUsedToday(recordDownload())
    const left = FREE_DAILY_LIMIT - downloadsUsedToday() - 1
    showToast(premium ? msg : `${msg} ${left < 0 ? 0 : left} free left today.`)
    setExporting(false)
  }

  const previewRatio = outputKey === 'program' ? '11 / 17' : output.ratio

  return (
    <div className="min-h-screen font-body text-slate-700">
      {/* Header */}
      <header className="shadow-sm">
        <div className="bg-white">
          <div className="mx-auto max-w-6xl px-4 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img src="/favicon.svg" alt="MemorialPrint" className="w-11 h-11 rounded-full shadow" />
              <div>
                <p className="font-display font-semibold text-3xl leading-none text-slate-800">MemorialPrint</p>
                <p className="text-slate-500 text-sm mt-1">Add the pieces that made them who they were.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {premium ? (
                <span className="bg-amber-600 text-white rounded-full px-3 py-1 text-sm font-bold">★ Premium</span>
              ) : (
                <button onClick={handleUpgrade} className="bg-amber-700 hover:bg-amber-600 text-white font-bold rounded-full px-4 py-2 text-sm shadow">
                  Get Premium — {PREMIUM_PRICE}
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="bg-slate-700">
          <div className="mx-auto max-w-6xl px-4 py-3">
            <p className="text-stone-200 text-sm text-center">
              A quiet place to make something beautiful for someone you loved. Take your time — there is no rush here.
            </p>
          </div>
        </div>
      </header>

      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm font-semibold px-4 py-2 rounded-full shadow-lg max-w-[92vw] text-center">
          {toast}
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6 grid lg:grid-cols-2 gap-6 items-start">
        {/* Preview + download */}
        <section>
          <div
            ref={previewBoxRef}
            className="relative mx-auto w-full max-w-[560px] rounded-2xl shadow-xl select-none overflow-hidden bg-white"
            style={{ aspectRatio: previewRatio }}
            onPointerDown={onPreviewPointerDown}
            onPointerMove={onPreviewPointerMove}
            onPointerUp={onPreviewPointerUp}
            onPointerLeave={onPreviewPointerUp}
          >
            <canvas ref={previewRef} className="block w-full h-full" />
            {/* Draggable placed elements (hit areas over the canvas) */}
            {placed.map((p) => {
              const isSel = p.uid === selectedUid
              if (p.kind === 'text') {
                const hasText = (p.text || '').trim()
                return (
                  <div
                    key={p.uid}
                    onPointerDown={(e) => onElementPointerDown(e, p.uid)}
                    className={`absolute cursor-move touch-none flex items-center justify-center ${isSel ? 'ring-2 ring-amber-600 rounded-md' : ''}`}
                    style={{
                      left: `${(p.x - p.w / 2) * 100}%`,
                      top: `${(p.y - (p.w * 0.75) / 2) * 100}%`,
                      width: `${p.w * 100}%`,
                      aspectRatio: '4 / 3',
                    }}
                    title="Ribbon words"
                  >
                    {hasText ? (
                      <span
                        className="pointer-events-none text-center leading-none"
                        style={{ fontFamily: "'Great Vibes', cursive", fontSize: `${Math.max(11, p.w * 60)}px`, color: '#43302B', textShadow: '0 0 4px #fff, 0 0 8px #fff' }}
                      >
                        {p.text}
                      </span>
                    ) : (
                      <span
                        className="pointer-events-none text-center leading-tight px-1"
                        style={{ fontFamily: "'Great Vibes', cursive", fontSize: `${Math.max(11, p.w * 44)}px`, color: '#8A6D3B' }}
                      >
                        Type their name…
                      </span>
                    )}
                  </div>
                )
              }
              const el = ELEMENTS[p.id]
              return (
                <div
                  key={p.uid}
                  onPointerDown={(e) => onElementPointerDown(e, p.uid)}
                  className={`absolute cursor-move touch-none ${isSel ? 'ring-2 ring-amber-600' : ''}`}
                  style={{
                    left: `${(p.x - p.w / 2) * 100}%`,
                    top: `${(p.y - (p.w * 0.75) / 2) * 100}%`,
                    width: `${p.w * 100}%`,
                    aspectRatio: '4 / 3',
                  }}
                  title={el.name}
                >
                  {/* When "Remove background" is on, the overlay photo is
                      hidden and the canvas tile underneath — blended onto
                      the design — is what shows, exactly as it will print. */}
                  <img
                    src={el.src}
                    alt={el.name}
                    draggable={false}
                    className="w-full h-full object-cover rounded-md shadow pointer-events-none"
                    style={p.hideBg ? { visibility: 'hidden' } : undefined}
                  />
                </div>
              )
            })}
            {placed.length === 0 && (
              <p className="absolute bottom-2 left-0 right-0 text-center text-[11px] text-slate-500 pointer-events-none">
                Add a photo, then add the pieces below.
              </p>
            )}
          </div>

          <p className="text-center text-xs text-slate-500 mt-2">
            {photo
              ? 'Drag the photo to move it · Drag a piece to move it · Tap a piece to resize it'
              : 'Your photo stays on your device — nothing is uploaded.'}
          </p>

          {outputKey === 'program' && (
            <div className="flex justify-center gap-2 mt-3">
              {['Cover', 'Order of Service', 'Obituary & Poem', 'Thank You'].map((label, i) => (
                <button
                  key={label}
                  onClick={() => setProgramPage(i)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${programPage === i ? 'bg-slate-700 text-white' : 'border border-slate-300 bg-white'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={downloadCurrent}
            disabled={exporting}
            className="mt-4 w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-60 text-white font-display font-semibold text-lg rounded-xl py-3 shadow"
          >
            {exporting ? 'Making your memorial…' : outputKey === 'program' ? '⬇ Download the funeral program (PDF)' : `⬇ Download my ${output.name.split('·')[0].trim().toLowerCase()} (PNG)`}
          </button>
          <p className="text-center text-sm text-slate-500 mt-2">
            {premium ? 'Premium · unlimited downloads' : `Free · ${Math.max(0, FREE_DAILY_LIMIT - usedToday)} of ${FREE_DAILY_LIMIT} downloads left today`}
          </p>
          {!premium && (
            <button onClick={handleUpgrade} className="mt-2 w-full border-2 border-amber-700 text-amber-800 font-bold rounded-xl py-2.5 text-sm hover:bg-amber-50">
              ★ Get Premium — {PREMIUM_PRICE}: every element, every font, every output
            </button>
          )}
        </section>

        {/* Controls */}
        <section className="space-y-5">
          {/* 1 · Photo */}
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-display font-semibold text-lg mb-2">1 · Their photo</h2>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => fileRef.current && fileRef.current.click()} className="bg-slate-700 text-white font-bold rounded-full px-4 py-2 text-sm">
                {photo ? 'Change photo' : '📷 Add their photo'}
              </button>
              {photo && (
                <button
                  onClick={() => { setPhoto(null); setPhotoName(''); setPhotoZoom(1); setPhotoPan({ x: 0, y: 0 }) }}
                  className="border border-slate-300 font-bold rounded-full px-4 py-2 text-sm"
                >
                  Remove
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPhotoFile(e.target.files && e.target.files[0])} />
            {photoName && <p className="text-xs text-slate-500 mt-2 truncate">{photoName}</p>}
            <p className="text-xs text-slate-500 mt-2">Your photo is processed in your browser and never uploaded anywhere.</p>
            {photo && (
              <div className="mt-4 space-y-3">
                <div className="flex gap-2">
                  <button onClick={() => setPhotoFit('fit')} className={`flex-1 rounded-full py-2 text-sm font-bold ${photoFit === 'fit' ? 'bg-slate-700 text-white' : 'border border-slate-300'}`}>Fit · whole photo</button>
                  <button onClick={() => setPhotoFit('fill')} className={`flex-1 rounded-full py-2 text-sm font-bold ${photoFit === 'fill' ? 'bg-slate-700 text-white' : 'border border-slate-300'}`}>Fill · crop to frame</button>
                </div>
                <div className="flex gap-2">
                  {['arch', 'oval', 'rect'].map((f) => (
                    <button key={f} onClick={() => setPhotoFrame(f)} className={`flex-1 rounded-full py-2 text-sm font-bold capitalize ${photoFrame === f ? 'bg-slate-700 text-white' : 'border border-slate-300'}`}>
                      {f === 'arch' ? 'Arch frame' : f === 'oval' ? 'Oval frame' : 'Rectangle'}
                    </button>
                  ))}
                </div>
                <label className="block text-sm font-semibold">Zoom <span className="font-normal text-slate-500">{photoZoom.toFixed(1)}×</span>
                  <input type="range" min="1" max="2.2" step="0.05" value={photoZoom} onChange={(e) => setPhotoZoom(parseFloat(e.target.value))} className="w-full" />
                </label>
              </div>
            )}
          </div>

          {/* 2 · Name & dates */}
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-display font-semibold text-lg mb-2">2 · Their name &amp; dates</h2>
            <label className="block text-sm font-semibold mb-1">Their name
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Margaret Rose Ellis" maxLength={48} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 font-normal" />
            </label>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <label className="block text-sm font-semibold">Born
                <input value={birthDate} onChange={(e) => setBirthDate(e.target.value)} placeholder="March 4, 1948" maxLength={32} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 font-normal" />
              </label>
              <label className="block text-sm font-semibold">Passed away
                <input value={deathDate} onChange={(e) => setDeathDate(e.target.value)} placeholder="November 12, 2026" maxLength={32} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 font-normal" />
              </label>
            </div>
            <p className="text-sm font-semibold mt-3 mb-1">Font for their name</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(FONTS).map(([key, f]) => (
                <button
                  key={key}
                  onClick={() => pickFont(key)}
                  className={`rounded-full px-3 py-1.5 text-sm ${fontKey === key ? 'bg-slate-700 text-white' : 'border border-slate-300'}`}
                  style={{ fontFamily: f.css }}
                >
                  {f.name}{f.premium && !premium ? ' 🔒' : ''}
                </button>
              ))}
            </div>
            <label className="block text-sm font-semibold mt-3">A few words — a verse, a quote, or a line of your own
              <input value={message} onChange={(e) => setMessage(e.target.value)} maxLength={120} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 font-normal" />
            </label>
            <div className="flex flex-wrap gap-2 mt-2">
              {VERSES.map((v) => (
                <button key={v} onClick={() => setMessage(v)} className={`text-left text-xs rounded-full px-3 py-1.5 border ${message === v ? 'bg-amber-50 border-amber-600 text-amber-900' : 'border-slate-300'}`}>
                  “{v}”
                </button>
              ))}
            </div>
          </div>

          {/* 3 · Service details */}
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-display font-semibold text-lg mb-2">3 · The service <span className="text-sm font-body font-normal text-slate-500">· for invitations &amp; programs</span></h2>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm font-semibold">Date
                <input value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} placeholder="Saturday, December 6, 2026" maxLength={48} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 font-normal" />
              </label>
              <label className="block text-sm font-semibold">Time
                <input value={serviceTime} onChange={(e) => setServiceTime(e.target.value)} placeholder="11:00 a.m." maxLength={24} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 font-normal" />
              </label>
            </div>
            <label className="block text-sm font-semibold mt-3">Place
              <input value={serviceLocation} onChange={(e) => setServiceLocation(e.target.value)} placeholder="St. Mary’s Chapel, Phoenix, AZ" maxLength={64} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 font-normal" />
            </label>
          </div>

          {/* 4 · Elements */}
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-display font-semibold text-lg mb-2">4 · Add the pieces <span className="text-sm font-body font-normal text-slate-500">· tap to add — drag them on the canvas</span></h2>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(ELEMENTS).map(([id, el]) => (
                <button key={id} onClick={() => addElement(id)} className="rounded-xl overflow-hidden border border-slate-200 hover:border-amber-600 text-left relative">
                  <img src={el.src} alt={el.name} className="w-full aspect-[4/3] object-cover" />
                  <span className="block text-[11px] font-bold px-1.5 py-1 bg-white/90 w-full">
                    {el.name}{el.premium && !premium ? ' 🔒' : ''}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {premium ? 'Up to 4 pieces on a canvas.' : 'Free adds up to 2 pieces. Premium unlocks all 18.'}
              {selected && selected.kind === 'text' ? (
                <span className="block mt-2">
                  Selected: <b>Ribbon words</b> <span className="font-normal text-slate-500">· drag them anywhere — on the ribbon or anywhere on the design</span>
                  <label className="block mt-1">Words on the ribbon
                    <input value={selected.text || ''} onChange={(e) => updateSelectedText(e.target.value)} placeholder="Type their name for the ribbon…" maxLength={48} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 font-normal" />
                  </label>
                  <label className="block mt-1">Size
                    <input type="range" min="0.12" max="0.45" step="0.01" value={selected.w} onChange={(e) => updateSelected(parseFloat(e.target.value))} className="w-full" />
                  </label>
                  <button onClick={() => removeElement(selected.uid)} className="text-red-700 font-bold text-xs mt-1">Remove these words</button>
                </span>
              ) : selected && (
                <span className="block mt-2">
                  Selected: <b>{ELEMENTS[selected.id].name}</b>
                  <label className="block mt-1">Size
                    <input type="range" min="0.12" max="0.45" step="0.01" value={selected.w} onChange={(e) => updateSelected(parseFloat(e.target.value))} className="w-full" />
                  </label>
                  {ELEMENTS[selected.id].mask ? (
                    <label className="flex items-center gap-2 mt-2 cursor-pointer font-bold">
                      <input type="checkbox" checked={!!selected.hideBg} onChange={toggleSelectedHideBg} className="w-4 h-4 accent-amber-700" />
                      Remove background
                    </label>
                  ) : (
                    <span className="block mt-2 font-bold text-slate-400">Remove background <span className="font-normal text-slate-500">· not available for this photo — its background can’t be separated from the subject</span></span>
                  )}
                  <span className="block font-normal text-slate-500">Just the subject shows — no photo background. Works best where the background is plain.</span>
                  <button onClick={() => removeElement(selected.uid)} className="text-red-700 font-bold text-xs mt-1">Remove this piece</button>
                </span>
              )}
            </p>
          </div>

          {/* 5 · Background */}
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-display font-semibold text-lg mb-2">5 · Background</h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(BACKGROUNDS).map(([key, b]) => (
                <button
                  key={key}
                  onClick={() => pickBackground(key)}
                  className={`rounded-full px-3 py-1.5 text-sm font-bold ${bgKey === key ? 'bg-slate-700 text-white' : 'border border-slate-300'}`}
                >
                  {b.name}{b.premium && !premium ? ' 🔒' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* 6 · Output */}
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-display font-semibold text-lg mb-2">6 · What to make</h2>
            <div className="space-y-2">
              {Object.entries(OUTPUTS).map(([key, o]) => (
                <button
                  key={key}
                  onClick={() => pickOutput(key)}
                  className={`w-full flex items-center justify-between rounded-xl border-2 px-3 py-2 text-sm font-bold text-left ${outputKey === key ? 'border-slate-700 bg-slate-50' : 'border-slate-200'}`}
                >
                  <span>{o.name} <span className="font-normal text-slate-500">· {o.note}</span></span>
                  {o.premium && !premium && <span className="text-amber-700">🔒 Premium</span>}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">One set of details feeds them all — the poster, the program, the invitation, the keepsakes and the t-shirt design.</p>
          </div>

          {/* Program details */}
          {outputKey === 'program' && (
            <div className="bg-white rounded-2xl shadow p-4">
              <h2 className="font-display font-semibold text-lg mb-2">Funeral program details</h2>
              <label className="block text-sm font-semibold">Order of service <span className="font-normal text-slate-500">· one line each</span>
                <textarea value={orderLines.join('\n')} onChange={(e) => setOrderLines(e.target.value.split('\n'))} rows={7} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 font-normal text-sm" />
              </label>
              <label className="block text-sm font-semibold mt-3">Obituary — a few words about their life
                <textarea value={obituary} onChange={(e) => setObituary(e.target.value)} rows={4} placeholder="A few words about their life…" maxLength={700} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 font-normal text-sm" />
              </label>
              <label className="block text-sm font-semibold mt-3">Poem or prayer
                <textarea value={poem} onChange={(e) => setPoem(e.target.value)} rows={2} maxLength={200} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 font-normal text-sm" />
              </label>
              <label className="block text-sm font-semibold mt-3">Thank-you note <span className="font-normal text-slate-500">· back page</span>
                <textarea value={thankYou} onChange={(e) => setThankYou(e.target.value)} rows={3} maxLength={300} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 font-normal text-sm" />
              </label>
            </div>
          )}

          {/* Free vs Premium */}
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-display font-semibold text-lg mb-2">Free vs Premium</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="border rounded-xl p-3">
                <p className="font-bold">Free</p>
                <ul className="mt-1 space-y-1 text-slate-600">
                  <li>✓ Poster / wall hanging</li>
                  <li>✓ Doves &amp; cross</li>
                  <li>✓ 2 elegant fonts</li>
                  <li>✓ 5 downloads a day</li>
                </ul>
              </div>
              <div className="border-2 border-amber-600 bg-amber-50 rounded-xl p-3">
                <p className="font-bold">Premium · {PREMIUM_PRICE}</p>
                <ul className="mt-1 space-y-1 text-slate-600">
                  <li>✓ All 18 elements</li>
                  <li>✓ All 5 fonts &amp; backgrounds</li>
                  <li>✓ Program, invitation, keepsakes</li>
                  <li>✓ T-shirt design file</li>
                  <li>✓ Unlimited downloads, no footer</li>
                </ul>
                {!premium && (
                  <button onClick={handleUpgrade} className="mt-2 w-full bg-amber-700 hover:bg-amber-600 text-white font-bold rounded-full py-1.5 text-sm">
                    Get Premium
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">One-time payment, no subscription. {isPremiumConfigured() ? '' : 'Premium checkout is being set up.'}</p>
          </div>

          {/* FAQ */}
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-display font-semibold text-lg mb-2">Questions</h2>
            <div className="space-y-3">
              {FAQS.map((f) => (
                <details key={f.q} className="text-sm">
                  <summary className="font-bold cursor-pointer">{f.q}</summary>
                  <p className="text-slate-600 mt-1">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="text-center text-xs text-slate-500 pb-8 px-4">
        MemorialPrint · Add the pieces that made them who they were. · Your photo never leaves your device.
        <span className="block mt-1">Element images: photographs, photorealistic images, and original drawings — credits in ATTRIBUTION.md.</span>
      </footer>
    </div>
  )
}
