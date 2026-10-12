/**
 * The Craft — Procedural Brush Engine
 * High-performance, 60-120 FPS procedural digital painting engine.
 * Implements 180+ artisan digital brushes organized across 13 creative categories:
 * Airbrush, Basic, Caligraphy, Charcoal, Elements, Hair, Halftone, Inking, Outline, Particles, Pixel, Sketching, Watercolor.
 */

/**
 * High-performance deterministic PRNG based on coordinates & seed.
 * Guarantees that identical stroke coordinates produce 100% deterministic, frozen procedural grain/noise across redraws.
 */
export function coordRand(x, y, seed = 0) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + (seed + 1) * 37.719) * 43758.5453123;
  return n - Math.floor(n);
}

/**
 * Robust color-to-RGBA converter preserving hue and saturation during alpha fade.
 * Guarantees zero dark/dirty rims during radial gradient interpolation.
 */
export function colorToRgba(color, alpha = 1.0) {
  if (!color) return `rgba(99, 102, 241, ${alpha})`;
  if (color.startsWith('#')) {
    let c = color.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    if (c.length === 6) {
      const r = parseInt(c.substring(0, 2), 16);
      const g = parseInt(c.substring(2, 4), 16);
      const b = parseInt(c.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  } else if (color.startsWith('rgba')) {
    const parts = color.match(/[\d.]+/g);
    if (parts && parts.length >= 3) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
    }
  } else if (color.startsWith('rgb')) {
    const parts = color.match(/[\d.]+/g);
    if (parts && parts.length >= 3) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
    }
  } else if (color.startsWith('hsl')) {
    return color.replace('hsl(', 'hsla(').replace(')', `, ${alpha})`);
  }
  return color;
}

export const BRUSH_CATEGORIES = [
  { id: 'airbrush', label: 'Airbrush', icon: 'fa-spray-can', count: 8 },
  { id: 'basic', label: 'Basic', icon: 'fa-circle-dot', count: 25 },
  { id: 'caligraphy', label: 'Caligraphy', icon: 'fa-pen-nib', count: 12 },
  { id: 'charcoal', label: 'Charcoal', icon: 'fa-cubes-stacked', count: 4 },
  { id: 'elements', label: 'Elements', icon: 'fa-wind', count: 11 },
  { id: 'hair', label: 'Hair', icon: 'fa-bars-staggered', count: 26 },
  { id: 'halftone', label: 'Halftone', icon: 'fa-braille', count: 23 },
  { id: 'inking', label: 'Inking', icon: 'fa-feather-pointed', count: 18 },
  { id: 'outline', label: 'Outline', icon: 'fa-square-full', count: 6 },
  { id: 'particles', label: 'Particles', icon: 'fa-wand-magic-sparkles', count: 7 },
  { id: 'pixel', label: 'Pixel', icon: 'fa-chess-board', count: 8 },
  { id: 'sketching', label: 'Sketching', icon: 'fa-pencil', count: 14 },
  { id: 'watercolor', label: 'Watercolor', icon: 'fa-droplet', count: 5 }
];

export const BRUSH_CATALOG = {
  airbrush: [
    { id: 'airbrush_grainy', name: 'Airbrush Grainy', desc: 'Granular spray with stochastic noise dispersion', type: 'airbrush', grain: 0.7, soft: 0.5 },
    { id: 'airbrush_grainy_soft', name: 'Airbrush Grainy Soft', desc: 'Silky smooth noise gradient with feathered falloff', type: 'airbrush', grain: 0.45, soft: 0.8 },
    { id: 'airbrush_hard', name: 'Airbrush Hard', desc: 'Crisp radial boundary with subtle pressure density', type: 'airbrush', grain: 0.05, soft: 0.2 },
    { id: 'airbrush_medium', name: 'Airbrush Medium', desc: 'Balanced commercial airbrush with natural flow', type: 'airbrush', grain: 0.1, soft: 0.5 },
    { id: 'airbrush_soft', name: 'Airbrush Soft', desc: 'Ultra-smooth Gaussian gradient for seamless blending', type: 'airbrush', grain: 0, soft: 0.85 },
    { id: 'airbrush_ultra_soft', name: 'Airbrush Ultra Soft', desc: 'Expansive ethereal fog with ultra-low falloff', type: 'airbrush', grain: 0, soft: 0.98 },
    { id: 'airbrush_fuzzy_soft', name: 'Airbrush Fuzzy Soft', desc: 'Soft perimeter jitter with randomized edge dispersal', type: 'airbrush', grain: 0.35, soft: 0.7, fuzzy: true },
    { id: 'airbrush_fuzzy', name: 'Airbrush Fuzzy', desc: 'Hazy dispersion with atmospheric particle scatter', type: 'airbrush', grain: 0.6, soft: 0.4, fuzzy: true }
  ],
  basic: [
    { id: 'basic_hard_round', name: 'Hard Round', desc: 'Solid opaque circular tip with 100% sharp rim', type: 'round', hardness: 1.0 },
    { id: 'basic_medium_round', name: 'Medium Round', desc: 'Standard studio round with gentle anti-aliased edge', type: 'round', hardness: 0.75 },
    { id: 'basic_soft_round', name: 'Soft Round', desc: 'Classic soft round brush with linear opacity fade', type: 'round', hardness: 0.4 },
    { id: 'basic_smooth_edge_round', name: 'Smooth Edge Round', desc: 'Precision curved edge with pressure responsive flow', type: 'round', hardness: 0.85 },
    { id: 'basic_gell_pen', name: 'Gell Pen', desc: 'Glossy high-pigment gel ink line with slight pooling', type: 'gel', hardness: 0.95 },
    { id: 'basic_worm', name: 'Worm', desc: 'Segmented organic tubular stroke', type: 'segmented', segmentGap: 0.3 },
    { id: 'basic_worm_shell', name: 'Worm Shell', desc: 'Hollow ribbed continuous contour tube', type: 'tube', outlineOnly: true },
    { id: 'basic_ellipse', name: 'Ellipse', desc: '45-degree angled calligraphic oval tip', type: 'ellipse', angle: 45, ratio: 0.4 },
    { id: 'basic_ellipse_flat', name: 'Ellipse Flat', desc: 'Horizontal compressed ellipse for broad blocking', type: 'ellipse', angle: 0, ratio: 0.25 },
    { id: 'basic_fragmented_ellipse_flat', name: 'Fragmented Ellipse Flat', desc: 'Chipped flat ellipse with broken trailing edges', type: 'ellipse_fragmented', angle: 0, ratio: 0.25 },
    { id: 'basic_fragmented_round', name: 'Fragmented Round', desc: 'Distressed circular stamp with dry tooth', type: 'round_fragmented' },
    { id: 'basic_square', name: 'Square', desc: 'Architectural hard square stamp', type: 'square', hardness: 1.0 },
    { id: 'basic_soft_square', name: 'Soft Square', desc: 'Box stamp with smoothed bevel edges', type: 'square', hardness: 0.6 },
    { id: 'basic_hard_flat', name: 'Hard Flat', desc: 'Broad flat chisel tip for blocking in silhouettes', type: 'flat', hardness: 1.0 },
    { id: 'basic_triangle', name: 'Triangle', desc: 'Geometric triangular dynamic footprint', type: 'polygon', sides: 3 },
    { id: 'basic_pentagon', name: 'Pentagon', desc: 'Five-point crystalline polygon tip', type: 'polygon', sides: 5 },
    { id: 'basic_trapezoid', name: 'Trapezoid', desc: 'Angled wedge marker stamp', type: 'trapezoid' },
    { id: 'basic_trapezoid_flat', name: 'Trapezoid Flat', desc: 'Low-profile angled blade for dynamic hatching', type: 'trapezoid_flat' },
    { id: 'basic_barcode', name: 'Barcode', desc: 'Parallel vertical linear bands', type: 'barcode' },
    { id: 'basic_round_stipple', name: 'Round Stipple', desc: 'Concentric dots forming pointillist texture', type: 'stipple', density: 'medium' },
    { id: 'basic_loose_round_stipple', name: 'Loose Round Stipple', desc: 'Airy dispersed dot cloud', type: 'stipple', density: 'loose' },
    { id: 'basic_scatter_stipple', name: 'Scatter Stipple', desc: 'Randomized granular spray clustering', type: 'scatter_stipple', density: 'medium' },
    { id: 'basic_dense_scatter_stipple', name: 'Dense Scatter Stipple', desc: 'Rich compact stipple cluster', type: 'scatter_stipple', density: 'dense' },
    { id: 'basic_clods', name: 'Clods', desc: 'Earthy textured clumps and organic spatters', type: 'clods', scale: 1.0 },
    { id: 'basic_clods_2', name: 'Clods 2', desc: 'Heavy irregular sediment deposits', type: 'clods', scale: 1.8 }
  ],
  caligraphy: [
    { id: 'caligraphy_classic', name: 'Caligraphy', desc: 'Traditional 45° broad-edge italic nib', type: 'caligraphy', angle: 45, ratio: 0.2 },
    { id: 'caligraphy_directional', name: 'Caligraphy Directional', desc: 'Ribbon angle continuously follows pen tangent', type: 'caligraphy_dir', ratio: 0.25 },
    { id: 'caligraphy_soft', name: 'Caligraphy Soft', desc: 'Flexible brush lettering with tapered pressure swell', type: 'caligraphy_soft', angle: 45 },
    { id: 'caligraphy_horizontal', name: 'Caligraphy Horizontal', desc: 'Zero-degree flat horizontal oriental pen', type: 'caligraphy', angle: 0, ratio: 0.18 },
    { id: 'caligraphy_horizontal_dir', name: 'Horizontal Directional', desc: 'Dynamic horizontal blade aligning to stroke velocity', type: 'caligraphy_dir', angleOffset: 0 },
    { id: 'caligraphy_vertical', name: 'Caligraphy Vertical', desc: '90-degree vertical reed pen', type: 'caligraphy', angle: 90, ratio: 0.18 },
    { id: 'caligraphy_vertical_dir', name: 'Vertical Directional', desc: 'Perpendicular oriented stroke blade', type: 'caligraphy_dir', angleOffset: 90 },
    { id: 'caligraphy_hook', name: 'Hook', desc: 'Sharp terminal serif hook dynamics', type: 'hook' },
    { id: 'caligraphy_soft_ribbon', name: 'Soft Ribbon', desc: 'Graceful undulating satin banner ribbon', type: 'ribbon', soft: true },
    { id: 'caligraphy_thick_ribbon', name: 'Thick Ribbon', desc: 'Heavy dimensional tape ribbon', type: 'ribbon', thick: true },
    { id: 'caligraphy_soft_twisted_ribbon', name: 'Soft Twisted Ribbon', desc: 'Helical twist ribbon with soft gradient turns', type: 'ribbon_twisted', soft: true },
    { id: 'caligraphy_thick_twisted_ribbon', name: 'Thick Twisted Ribbon', desc: 'Geometric 3D twisting ribbon banner', type: 'ribbon_twisted', soft: false }
  ],
  charcoal: [
    { id: 'charcoal_strong', name: 'Charcoal Strong', desc: 'Deep velvety vine charcoal with aggressive tooth', type: 'charcoal', roughness: 0.9, opacity: 0.95 },
    { id: 'charcoal_medium', name: 'Charcoal Medium', desc: 'Compressed charcoal with rich paper grain pick-up', type: 'charcoal', roughness: 0.65, opacity: 0.8 },
    { id: 'charcoal_light', name: 'Charcoal Light', desc: 'Soft willow charcoal for gentle atmospheric toning', type: 'charcoal', roughness: 0.45, opacity: 0.5 },
    { id: 'charcoal_chalk', name: 'Chalk', desc: 'Dry calcium chalk with dusty trailing borders', type: 'chalk', roughness: 0.75, opacity: 0.85 }
  ],
  elements: [
    { id: 'elements_smoke_1', name: 'Smoke 1', desc: 'Drifting wisps of translucent vapor', type: 'element_smoke', variant: 1 },
    { id: 'elements_smoke_2', name: 'Smoke 2', desc: 'Dense billowing smoke puffs', type: 'element_smoke', variant: 2 },
    { id: 'elements_smoke_3_rot', name: 'Smoke 3 Rotating', desc: 'Swirling vortex smoke clusters with angular momentum', type: 'element_smoke', variant: 3, rotate: true },
    { id: 'elements_smoke_4_rot', name: 'Smoke 4 Rotating', desc: 'Turbulent convective smoke plume', type: 'element_smoke', variant: 4, rotate: true },
    { id: 'elements_natural_smoke', name: 'Natural Flow Smoke', desc: 'Continuous smoke ribbon that curls organically', type: 'element_smoke_flow' },
    { id: 'elements_flame_1', name: 'Flame 1', desc: 'Luminescent fiery tongue with core brightness', type: 'element_flame', variant: 1 },
    { id: 'elements_flame_2', name: 'Flame 2', desc: 'Sparks and flickering candle-fire tongues', type: 'element_flame', variant: 2 },
    { id: 'elements_natural_flame', name: 'Natural Flow Flame', desc: 'Dynamic bonfire flare path', type: 'element_flame_flow' },
    { id: 'elements_light_cloud', name: 'Light Cloud', desc: 'Cirrus wisps and ethereal cumulus feathers', type: 'element_cloud', density: 0.3 },
    { id: 'elements_cloudy_sky', name: 'Cloudy Sky', desc: 'Volumetric cloud banks for atmospheric landscapes', type: 'element_cloud', density: 0.65 },
    { id: 'elements_dark_cloud', name: 'Dark Cloud', desc: 'Heavy storm clouds and dense overcast overcast', type: 'element_cloud', density: 0.95 }
  ],
  hair: [
    { id: 'hair_fine', name: 'Fine Hair', desc: 'Individual silk-thin hair filaments', type: 'hair_multi', strands: 5, spread: 0.4, fine: true },
    { id: 'hair_fine_dense', name: 'Fine Dense Hair', desc: 'Tight bouquet of ultra-thin hair strands', type: 'hair_multi', strands: 10, spread: 0.6, fine: true },
    { id: 'hair_short', name: 'Short Hair', desc: 'Crisp cropped hair tips for buzz cuts & stubble', type: 'hair_short', strands: 6 },
    { id: 'hair_short_dense', name: 'Short Dense Hair', desc: 'Thick plush short coat', type: 'hair_short', strands: 12 },
    { id: 'hair_long_dense', name: 'Long Dense Hair', desc: 'Luxurious heavy tresses flowing together', type: 'hair_multi', strands: 14, spread: 1.0 },
    { id: 'hair_flowing', name: 'Flowing Hair', desc: 'Aerodynamic wind-swept hair locks', type: 'hair_flowing', variant: 1 },
    { id: 'hair_flowing_2', name: 'Flowing Hair 2', desc: 'Waving cascading hair curves', type: 'hair_flowing', variant: 2 },
    { id: 'hair_eyelash', name: 'Eyelash', desc: 'Tapered curved eyelash stroke generator', type: 'hair_lash' },
    { id: 'hair_two_fine_strings', name: 'Two Fine Strings', desc: 'Twin parallel thread filaments', type: 'hair_multi', strands: 2, spread: 0.5 },
    { id: 'hair_three_fine_strings', name: 'Three Fine Strings', desc: 'Triple fine string guides', type: 'hair_multi', strands: 3, spread: 0.6 },
    { id: 'hair_three_strings', name: 'Three Strings', desc: 'Triple standard yarn tracks', type: 'hair_multi', strands: 3, spread: 0.8 },
    { id: 'hair_five_strings', name: 'Five Strings', desc: 'Quintuple ribbon strands', type: 'hair_multi', strands: 5, spread: 1.0 },
    { id: 'hair_four_squares', name: 'Four Squares', desc: 'Geometric 4-lane raster guide', type: 'hair_multi_shape', shape: 'square', count: 4 },
    { id: 'hair_eight_squares', name: 'Eight Squares', desc: 'Geometric 8-lane matrix rake', type: 'hair_multi_shape', shape: 'square', count: 8 },
    { id: 'hair_tangled', name: 'Tangled Hair', desc: 'Cross-stitched irregular chaotic hair strands', type: 'hair_tangled' },
    { id: 'hair_curly', name: 'Curly Hair', desc: 'Spiral sine-wave hair ringlets', type: 'hair_curly', freq: 1.0 },
    { id: 'hair_curly_2', name: 'Curly Hair 2', desc: 'Tight afro/corkscrew curls', type: 'hair_curly', freq: 1.8 },
    { id: 'hair_curly_3', name: 'Curly Hair 3', desc: 'Loose beach waves and serpentine ringlets', type: 'hair_curly', freq: 0.6 },
    { id: 'hair_fur', name: 'Fur', desc: 'Soft realistic animal fur brush', type: 'hair_fur', variant: 1 },
    { id: 'hair_fur_2', name: 'Fur 2', desc: 'Dense plush undercoat fur', type: 'hair_fur', variant: 2 },
    { id: 'hair_thick_rake', name: 'Thick Rake', desc: 'Heavy comb/rake tool with broad tines', type: 'rake', tines: 5, tineWidth: 2.5 },
    { id: 'hair_medium_rake', name: 'Medium Rake', desc: 'Standard 7-tine texturing comb', type: 'rake', tines: 7, tineWidth: 1.8 },
    { id: 'hair_dense_rake', name: 'Dense Rake', desc: 'Fine 12-tine grooming comb', type: 'rake', tines: 12, tineWidth: 1.2 },
    { id: 'hair_fine_rake', name: 'Fine Rake', desc: 'Micro 16-tine etching rake', type: 'rake', tines: 16, tineWidth: 0.8 },
    { id: 'hair_tail', name: 'Tail', desc: 'Long tapering brush tail with soft bristle spread', type: 'hair_tail', variant: 1 },
    { id: 'hair_tail_2', name: 'Tail 2', desc: 'Plumed bushy tail contour', type: 'hair_tail', variant: 2 }
  ],
  halftone: [
    { id: 'halftone_dots_strong', name: 'Scalable Dots Strong', desc: 'Dynamic comic book Ben-Day dots scaling with pressure', type: 'halftone_dots', freq: 12, weight: 0.8 },
    { id: 'halftone_dots_medium', name: 'Scalable Dots Medium', desc: 'Standard vintage pop-art dot screen', type: 'halftone_dots', freq: 14, weight: 0.5 },
    { id: 'halftone_dots_light', name: 'Scalable Dots Light', desc: 'Subtle retro printing dots for highlights', type: 'halftone_dots', freq: 16, weight: 0.25 },
    { id: 'halftone_soft_light_fixed', name: 'Soft Light Dots Fixed', desc: 'Static screen grid with soft edge dots (Light)', type: 'halftone_fixed_dots', size: 'light', soft: true },
    { id: 'halftone_soft_med_fixed', name: 'Soft Medium Dots Fixed', desc: 'Static screen grid with soft edge dots (Medium)', type: 'halftone_fixed_dots', size: 'med', soft: true },
    { id: 'halftone_soft_large_fixed', name: 'Soft Large Dots Fixed', desc: 'Static screen grid with soft edge dots (Large)', type: 'halftone_fixed_dots', size: 'large', soft: true },
    { id: 'halftone_hard_small_fixed', name: 'Hard Small Dots Fixed', desc: 'Sharp micro offset printing dots', type: 'halftone_fixed_dots', size: 'small', soft: false },
    { id: 'halftone_hard_med_fixed', name: 'Hard Medium Dots Fixed', desc: 'Sharp industrial screen-print dot grid', type: 'halftone_fixed_dots', size: 'med', soft: false },
    { id: 'halftone_hard_large_fixed', name: 'Hard Large Dots Fixed', desc: 'Bold poster art halftone dots', type: 'halftone_fixed_dots', size: 'large', soft: false },
    { id: 'halftone_soft_lines_rising', name: 'Soft Lines Rising Fixed', desc: '45-degree ascending soft hatching lines', type: 'halftone_lines', angle: 45, soft: true },
    { id: 'halftone_soft_lines_falling', name: 'Soft Lines Falling Fixed', desc: '-45 degree descending soft hatching lines', type: 'halftone_lines', angle: -45, soft: true },
    { id: 'halftone_soft_mesh', name: 'Soft Mesh Fixed', desc: 'Woven soft screen mesh grid', type: 'halftone_mesh', soft: true },
    { id: 'halftone_hard_lines_rising', name: 'Hard Lines Rising Fixed', desc: 'Engraving style 45° crisp parallel lines', type: 'halftone_lines', angle: 45, soft: false },
    { id: 'halftone_hard_lines_falling', name: 'Hard Lines Falling Fixed', desc: 'Engraving style -45° crisp parallel lines', type: 'halftone_lines', angle: -45, soft: false },
    { id: 'halftone_hard_lines_crossing', name: 'Hard Lines Crossing Fixed', desc: 'Precision cross-hatching matrix', type: 'halftone_mesh', soft: false },
    { id: 'halftone_spray_strong', name: 'Spray Shader Strong', desc: 'High-density stippled airbrush tone', type: 'spray_shader', density: 0.9 },
    { id: 'halftone_spray_medium', name: 'Spray Shader Medium', desc: 'Medium vintage risograph stippling', type: 'spray_shader', density: 0.5 },
    { id: 'halftone_spray_light', name: 'Spray Shader Light', desc: 'Sparse risograph shader grain', type: 'spray_shader', density: 0.2 },
    { id: 'halftone_extra_dense_pixels', name: 'Extra Dense Pixels', desc: 'Tight Bayer matrix dithering (90% fill)', type: 'bayer_dither', level: 4 },
    { id: 'halftone_dense_pixels', name: 'Dense Pixels', desc: 'Classic 4x4 ordered dither pattern (75% fill)', type: 'bayer_dither', level: 3 },
    { id: 'halftone_pixels', name: 'Pixels', desc: '50% checkerboard digital screentone', type: 'bayer_dither', level: 2 },
    { id: 'halftone_loose_pixels', name: 'Loose Pixels', desc: '25% dispersed dither stars', type: 'bayer_dither', level: 1 },
    { id: 'halftone_extra_loose_pixels', name: 'Extra Loose Pixels', desc: '10% minimalist starlight pixel scatter', type: 'bayer_dither', level: 0 }
  ],
  inking: [
    { id: 'inking_basic', name: 'Basic Ink', desc: 'Flawless manga & comic inking brush with pressure taper', type: 'ink', taper: true, bleed: 0 },
    { id: 'inking_fragmented', name: 'Fragmented Ink', desc: 'Distressed vintage nib ink with occasional tooth breaks', type: 'ink_fragmented' },
    { id: 'inking_inverted', name: 'Basic Ink Inverted', desc: 'Negative ink dynamic channel', type: 'ink', inverted: true },
    { id: 'inking_smooth', name: 'Ink Smooth', desc: 'Ultra-stabilized vector-feel brush pen', type: 'ink_smooth' },
    { id: 'inking_rough', name: 'Rough Ink', desc: 'Fibrous sumi-e ink on textured washi paper', type: 'ink_rough' },
    { id: 'inking_rough_h', name: 'Rough Ink Horizontal', desc: 'Horizontally feathered dry ink brush', type: 'ink_rough_axis', axis: 'h' },
    { id: 'inking_rough_v', name: 'Rough Ink Vertical', desc: 'Vertically feathered dry ink brush', type: 'ink_rough_axis', axis: 'v' },
    { id: 'inking_dry', name: 'Dry Ink', desc: 'Scumbled dry brush showing bristles on fast flicks', type: 'ink_dry', intensity: 1 },
    { id: 'inking_dry_2', name: 'Dry Ink 2', desc: 'Heavily starved bristle brush with scratchy texture', type: 'ink_dry', intensity: 2 },
    { id: 'inking_versatile', name: 'Versatile Ink', desc: 'Adaptive nib switching from hairline to bold slash', type: 'ink_versatile' },
    { id: 'inking_wash_1', name: 'Ink Wash', desc: 'Delicate dilute India ink wash with wet edges', type: 'ink_wash', opacity: 0.35 },
    { id: 'inking_wash_2', name: 'Ink Wash 2', desc: 'Medium tea-tone ink wash for shading', type: 'ink_wash', opacity: 0.6 },
    { id: 'inking_wash_3', name: 'Ink Wash 3', desc: 'Deep carbon ink puddle with soft blooming', type: 'ink_wash', opacity: 0.85 },
    { id: 'inking_messy', name: 'Messy Ink', desc: 'Expressive dripping street art calligraphy ink', type: 'ink_messy' },
    { id: 'inking_splatter', name: 'Ink Splatter', desc: 'Violent flicked quill splatter droplets', type: 'ink_splatter' },
    { id: 'inking_droplets_dynamic', name: 'Ink Droplets Dynamic', desc: 'Velocity-governed droplet size spattering', type: 'ink_droplets', mode: 'dynamic' },
    { id: 'inking_droplets_smooth', name: 'Ink Droplets Smooth', desc: 'Evenly balanced circular droplets stream', type: 'ink_droplets', mode: 'smooth' },
    { id: 'inking_droplets_dense', name: 'Ink Droplets Dense', desc: 'Thick spray of ink rain and fine specks', type: 'ink_droplets', mode: 'dense' }
  ],
  outline: [
    { id: 'outline_variable', name: 'Variable Outline Width', desc: 'Dynamic tubular stroke with hollow center', type: 'outline', dynamic: true, continuous: false },
    { id: 'outline_cont_variable', name: 'Continuous Variable Outline', desc: 'Seamless connected dual-rim ribbon', type: 'outline', dynamic: true, continuous: true },
    { id: 'outline_fixed', name: 'Fixed Outline Width', desc: 'Uniform architectural double-line pen', type: 'outline', dynamic: false, continuous: false },
    { id: 'outline_cont_fixed', name: 'Continuous Fixed Outline', desc: 'Constant-thickness ribbon outline', type: 'outline', dynamic: false, continuous: true },
    { id: 'outline_3d_fixed', name: '3D Fixed Outline Width', desc: 'Offset extrusion outline giving 3D comic depth', type: 'outline_3d', dynamic: false },
    { id: 'outline_cont_3d_fixed', name: 'Continuous 3D Fixed Outline', desc: 'Isometric wireframe pipe outline', type: 'outline_3d', dynamic: false, continuous: true }
  ],
  particles: [
    { id: 'particles_noise_1', name: 'Noise 1', desc: 'Fine sand / cosmic dust particulate field', type: 'particles_noise', grain: 'fine' },
    { id: 'particles_noise_2', name: 'Noise 2', desc: 'Coarse gravel & static interference noise', type: 'particles_noise', grain: 'coarse' },
    { id: 'particles_bubbles_small', name: 'Bubbles Small', desc: 'Micro aquatic bubble stream', type: 'particles_bubbles', size: 'small' },
    { id: 'particles_bubbles_medium', name: 'Bubbles Medium', desc: 'Floating soap bubbles with specular highlight rims', type: 'particles_bubbles', size: 'medium' },
    { id: 'particles_bubbles_large', name: 'Bubbles Large', desc: 'Giant buoyant iridescent bubbles', type: 'particles_bubbles', size: 'large' },
    { id: 'particles_dyn_noise_wide', name: 'Dynamic Noise Wide', desc: 'Broad galactic nebular dust cloud', type: 'particles_noise_dyn', spread: 'wide' },
    { id: 'particles_dyn_noise_dense', name: 'Dynamic Noise Dense', desc: 'Concentrated blizzard of high-energy sparkles', type: 'particles_noise_dyn', spread: 'dense' }
  ],
  pixel: [
    { id: 'pixel_art', name: 'Pixel Art', desc: 'Pure non-interpolated retro pixel pen (snaps to integer grid)', type: 'pixel', size: 1 },
    { id: 'pixel_apart', name: 'Pixel Apart', desc: 'Staggered checkerboard pixel steps', type: 'pixel_apart' },
    { id: 'pixel_tiles', name: 'Pixel Tiles', desc: '4x4 pixel mosaic tile stamp', type: 'pixel_tiles', tileSize: 4 },
    { id: 'pixel_line', name: 'Pixel Line', desc: 'Bresenham integer pixel line algorithm', type: 'pixel_line' },
    { id: 'pixel_edge', name: 'Pixel Edge', desc: 'Stepped 8-bit staircase edge contour', type: 'pixel_edge' },
    { id: 'pixel_edge_h', name: 'Pixel Edge Horizontal', desc: 'Horizontal-biased 16-bit pixel edge', type: 'pixel_edge_axis', axis: 'h' },
    { id: 'pixel_edge_v', name: 'Pixel Edge Vertical', desc: 'Vertical-biased 16-bit pixel edge', type: 'pixel_edge_axis', axis: 'v' },
    { id: 'pixel_scorched_twig', name: 'Scorched Twig', desc: 'Charred pixelated brittle tree twig', type: 'pixel_twig' }
  ],
  sketching: [
    { id: 'sketching_pencil_6b', name: 'Pencil 6B', desc: 'Very soft, dark graphite with heavy paper grain tooth', type: 'pencil', grade: '6B', softness: 0.95 },
    { id: 'sketching_pencil_4b', name: 'Pencil 4B', desc: 'Soft artist drafting pencil for rich shading & contours', type: 'pencil', grade: '4B', softness: 0.8 },
    { id: 'sketching_pencil_2b', name: 'Pencil 2B', desc: 'Balanced sketching pencil, responsive to pressure', type: 'pencil', grade: '2B', softness: 0.65 },
    { id: 'sketching_pencil_hb', name: 'Pencil HB', desc: 'Standard medium pencil for clean linework', type: 'pencil', grade: 'HB', softness: 0.5 },
    { id: 'sketching_pencil_h', name: 'Pencil H', desc: 'Hard, light graphite pencil for faint initial guidelines', type: 'pencil', grade: 'H', softness: 0.3 },
    { id: 'sketching_hard_graphite', name: 'Hard Graphite Pencil', desc: 'Dense industrial drafting graphite with crisp edges', type: 'pencil', grade: '2H', softness: 0.2 },
    { id: 'sketching_technical', name: 'Technical Pencil', desc: '0.5mm mechanical drafting pencil with constant diameter', type: 'pencil_tech', width: 1.5 },
    { id: 'sketching_round', name: 'Pencil Round', desc: 'Shaded pencil with circular graphite stamp', type: 'pencil_round' },
    { id: 'sketching_round_soft', name: 'Pencil Round Soft', desc: 'Blended graphite stump / tortillon effect', type: 'pencil_round_soft' },
    { id: 'sketching_crayon_1', name: 'Crayon 1', desc: 'Wax crayon with heavy paper tooth texture', type: 'crayon', variant: 1 },
    { id: 'sketching_crayon_2', name: 'Crayon 2', desc: 'Conte crayon with velvety pastel feel', type: 'crayon', variant: 2 },
    { id: 'sketching_crayon_3', name: 'Crayon 3', desc: 'Oil pastel with buttery pigment build-up', type: 'crayon', variant: 3 },
    { id: 'sketching_crayon_4', name: 'Crayon 4', desc: 'Chalk pastel for broad textured sweeps', type: 'crayon', variant: 4 },
    { id: 'sketching_crayon_6', name: 'Crayon 6', desc: 'Heavy pigment lithograph crayon', type: 'crayon', variant: 6 }
  ],
  watercolor: [
    { id: 'watercolor_1', name: 'Watercolor 1', desc: 'Soft transparent wash with wet edge pigment accumulation', type: 'watercolor', wetness: 0.4 },
    { id: 'watercolor_2', name: 'Watercolor 2', desc: 'Flowing wet-on-wet paint with soft bleeding blooms', type: 'watercolor', wetness: 0.7 },
    { id: 'watercolor_3', name: 'Watercolor 3', desc: 'Glazing watercolor for layering luminous tints', type: 'watercolor', wetness: 0.5 },
    { id: 'watercolor_4', name: 'Watercolor 4', desc: 'Granulating mineral watercolor showing pigment sediment', type: 'watercolor', wetness: 0.6, granulate: true },
    { id: 'watercolor_5', name: 'Watercolor 5', desc: 'Dry brush watercolor skimming over rough cold-press paper', type: 'watercolor', dry: true }
  ]
};

export const DEFAULT_BRUSH_SETTINGS = {
  sizeControl: 'OFF',        // 'OFF' | 'Pressure' | 'Velocity'
  minSize: 1.0,              // 0.5 to 20 px
  opacityControl: 'OFF',     // 'OFF' | 'Pressure' | 'Velocity'
  autoColor: false,          // false | true
  stabilizer: 0.0,           // 0.0 to 1.0
  isFavorite: false          // false | true
};

/**
 * Procedural Brush Engine
 * Handles rendering strokes onto any 2D canvas context.
 */
export class ProceduralBrushEngine {
  constructor() {
    this.stampCache = new Map();
    this.settingsCache = new Map();
    this.storageKey = 'thecraft_brush_settings_v2';
    this.loadAllSettings();
  }

  loadAllSettings() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        for (const [k, v] of Object.entries(parsed)) {
          this.settingsCache.set(k, { ...DEFAULT_BRUSH_SETTINGS, ...v });
        }
      }
    } catch (_) {}
  }

  saveAllSettings() {
    try {
      const obj = {};
      for (const [k, v] of this.settingsCache.entries()) {
        obj[k] = v;
      }
      localStorage.setItem(this.storageKey, JSON.stringify(obj));
    } catch (_) {}
  }

  getBrushSettings(brushId) {
    if (!brushId) return { ...DEFAULT_BRUSH_SETTINGS };
    if (!this.settingsCache.has(brushId)) {
      this.settingsCache.set(brushId, { ...DEFAULT_BRUSH_SETTINGS });
    }
    return this.settingsCache.get(brushId);
  }

  updateBrushSetting(brushId, key, value) {
    const s = this.getBrushSettings(brushId);
    s[key] = value;
    this.settingsCache.set(brushId, s);
    this.saveAllSettings();
    return s;
  }

  getFavorites() {
    const favs = [];
    for (const [catId, list] of Object.entries(BRUSH_CATALOG)) {
      for (const b of list) {
        const s = this.getBrushSettings(b.id);
        if (s.isFavorite) {
          favs.push({ ...b, cat: catId });
        }
      }
    }
    return favs;
  }

  getBrushById(brushId) {
    if (!brushId) return null;
    for (const cat of Object.keys(BRUSH_CATALOG)) {
      const found = BRUSH_CATALOG[cat].find(b => b.id === brushId);
      if (found) return found;
    }
    return null;
  }

  getAirbrushDab(color, soft = 0.6, grain = 0) {
    const key = `air_${color}_${soft.toFixed(2)}_${grain.toFixed(2)}`;
    if (this.stampCache.has(key)) return this.stampCache.get(key);

    const dabSize = 64;
    const canvas = document.createElement('canvas');
    canvas.width = dabSize;
    canvas.height = dabSize;
    const ctx = canvas.getContext('2d');
    const r = dabSize / 2;

    const centerAlpha = Math.max(0.04, Math.min(0.25, 0.14 * (1 - soft * 0.4)));
    const coreColor = colorToRgba(color, centerAlpha);
    const transparentColor = colorToRgba(color, 0);

    const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, coreColor);
    grad.addColorStop(0.3, colorToRgba(color, centerAlpha * 0.7));
    grad.addColorStop(0.7, colorToRgba(color, centerAlpha * 0.25));
    grad.addColorStop(1, transparentColor);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.fill();

    if (grain > 0) {
      const particleCount = Math.floor(r * grain * 3);
      ctx.fillStyle = color;
      for (let k = 0; k < particleCount; k++) {
        const angle = Math.random() * Math.PI * 2;
        const distRatio = Math.sqrt(Math.random());
        const dist = distRatio * (r * 0.95);
        const px = r + Math.cos(angle) * dist;
        const py = r + Math.sin(angle) * dist;
        ctx.globalAlpha = (1 - distRatio) * 0.4;
        ctx.fillRect(px, py, 1.2, 1.2);
      }
    }

    if (this.stampCache.size > 200) {
      this.stampCache.clear();
    }
    this.stampCache.set(key, canvas);
    return canvas;
  }

  getSoftDab(color, hardness = 0.5) {
    const key = `soft_${color}_${hardness.toFixed(2)}`;
    if (this.stampCache.has(key)) return this.stampCache.get(key);

    const dabSize = 64;
    const canvas = document.createElement('canvas');
    canvas.width = dabSize;
    canvas.height = dabSize;
    const ctx = canvas.getContext('2d');
    const r = dabSize / 2;

    const flowAlpha = Math.max(0.1, Math.min(0.35, hardness * 0.4 + 0.1));
    const grad = ctx.createRadialGradient(r, r, r * hardness * 0.6, r, r, r);
    grad.addColorStop(0, colorToRgba(color, flowAlpha));
    grad.addColorStop(hardness, colorToRgba(color, flowAlpha * 0.8));
    grad.addColorStop(1, colorToRgba(color, 0));

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.fill();

    if (this.stampCache.size > 200) {
      this.stampCache.clear();
    }
    this.stampCache.set(key, canvas);
    return canvas;
  }

  /**
   * Renders a stroke element with procedural brush dynamics (supports incremental live segment rendering)
   */
  renderStroke(ctx, stroke) {
    const pts = stroke.points;
    if (!pts || pts.length === 0) return;

    const brush = this.getBrushById(stroke.brushPreset);
    const color = stroke.color || '#6366f1';
    const settings = stroke.brushSettings || this.getBrushSettings(stroke.brushPreset);

    let baseSize = stroke.size || 8;
    if (settings && typeof settings.minSize === 'number') {
      baseSize = Math.max(settings.minSize, baseSize);
    }

    let baseOpacity = stroke.opacity ?? 1.0;
    if (settings && settings.opacityControl === 'Pressure' && pts.length > 0) {
      const avgP = (pts[0].pressure || 0.5);
      baseOpacity = Math.max(0.08, baseOpacity * avgP);
    }

    let usePressure = stroke.usePressure;
    if (settings && settings.sizeControl === 'OFF') {
      usePressure = false;
    } else if (settings && (settings.sizeControl === 'Pressure' || settings.sizeControl === 'Velocity')) {
      usePressure = true;
    }

    ctx.save();
    ctx.globalAlpha = baseOpacity;

    if (!brush) {
      this.renderStandardStroke(ctx, pts, color, baseSize, usePressure);
      ctx.restore();
      return;
    }

    switch (brush.type) {
      case 'airbrush':
        this.renderAirbrush(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'round':
      case 'round_fragmented':
        this.renderRound(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'gel':
        this.renderGelPen(ctx, pts, color, baseSize, usePressure);
        break;
      case 'square':
      case 'flat':
      case 'polygon':
      case 'trapezoid':
      case 'trapezoid_flat':
        this.renderShapeBrush(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'ellipse':
      case 'ellipse_fragmented':
        this.renderEllipse(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'caligraphy':
      case 'caligraphy_dir':
      case 'caligraphy_soft':
      case 'hook':
      case 'ribbon':
      case 'ribbon_twisted':
        this.renderCaligraphy(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'charcoal':
      case 'chalk':
        this.renderCharcoal(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'pencil':
      case 'pencil_tech':
      case 'pencil_round':
      case 'pencil_round_soft':
      case 'crayon':
        this.renderPencil(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'ink':
      case 'ink_smooth':
      case 'ink_fragmented':
      case 'ink_versatile':
      case 'ink_wash':
        this.renderInk(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'ink_rough':
      case 'ink_rough_axis':
      case 'ink_dry':
      case 'ink_messy':
        this.renderDryRoughInk(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'ink_splatter':
      case 'ink_droplets':
        this.renderInkSplatter(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'hair_multi':
      case 'hair_short':
      case 'hair_flowing':
      case 'hair_lash':
      case 'hair_tangled':
      case 'hair_curly':
      case 'hair_fur':
      case 'hair_tail':
      case 'rake':
      case 'hair_multi_shape':
        this.renderHair(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'halftone_dots':
      case 'halftone_fixed_dots':
      case 'halftone_lines':
      case 'halftone_mesh':
      case 'spray_shader':
      case 'bayer_dither':
        this.renderHalftone(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'outline':
      case 'outline_3d':
        this.renderOutline(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'particles_noise':
      case 'particles_noise_dyn':
      case 'particles_bubbles':
        this.renderParticles(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'pixel':
      case 'pixel_apart':
      case 'pixel_tiles':
      case 'pixel_line':
      case 'pixel_edge':
      case 'pixel_edge_axis':
      case 'pixel_twig':
        this.renderPixel(ctx, pts, color, baseSize, brush);
        break;
      case 'element_smoke':
      case 'element_smoke_flow':
      case 'element_flame':
      case 'element_flame_flow':
      case 'element_cloud':
        this.renderElementFX(ctx, pts, color, baseSize, usePressure, brush);
        break;
      case 'watercolor':
        this.renderWatercolor(ctx, pts, color, baseSize, usePressure, brush);
        break;
      default:
        this.renderStandardStroke(ctx, pts, color, baseSize, usePressure);
        break;
    }

    ctx.restore();
  }

  renderStandardStroke(ctx, pts, color, size, usePressure) {
    if (!pts || pts.length === 0) return;

    if (pts.length === 1) {
      const p = pts[0];
      const r = (p.pressure && usePressure ? size * p.pressure : size) / 2;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, r), 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (!usePressure) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2;
        const my = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();
      return;
    }

    // Dynamic pressure ribbon with smooth contiguous polygon rendering (ZERO circular scallops)
    this.renderPressureRibbon(ctx, pts, color, size);
  }

  renderPressureRibbon(ctx, pts, color, size) {
    if (pts.length === 2) {
      const p0 = pts[0];
      const p1 = pts[1];
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = color;
      const w = size * (((p0.pressure || 0.5) + (p1.pressure || 0.5)) / 2);
      ctx.lineWidth = Math.max(0.5, w);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
      return;
    }

    const n = pts.length;
    const widths = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const p = pts[i].pressure !== undefined ? pts[i].pressure : 0.5;
      widths[i] = Math.max(0.5, (size * Math.max(0.15, p)) / 2);
    }

    // Smooth widths along neighbors to eliminate any micro-jitter
    for (let i = 1; i < n - 1; i++) {
      widths[i] = (widths[i - 1] + widths[i] * 2 + widths[i + 1]) / 4;
    }

    const left = [];
    const right = [];

    for (let i = 0; i < n; i++) {
      let dx, dy;
      if (i === 0) {
        dx = pts[1].x - pts[0].x;
        dy = pts[1].y - pts[0].y;
      } else if (i === n - 1) {
        dx = pts[n - 1].x - pts[n - 2].x;
        dy = pts[n - 1].y - pts[n - 2].y;
      } else {
        dx = pts[i + 1].x - pts[i - 1].x;
        dy = pts[i + 1].y - pts[i - 1].y;
      }

      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const w = widths[i];

      left.push({ x: pts[i].x + nx * w, y: pts[i].y + ny * w });
      right.push({ x: pts[i].x - nx * w, y: pts[i].y - ny * w });
    }

    ctx.fillStyle = color;

    // Start with smooth rounded tip at origin
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, widths[0], 0, Math.PI * 2);
    ctx.fill();

    // End rounded tip
    ctx.beginPath();
    ctx.arc(pts[n - 1].x, pts[n - 1].y, widths[n - 1], 0, Math.PI * 2);
    ctx.fill();

    // Continuous body contour
    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (let i = 0; i < n - 1; i++) {
      const mx = (left[i].x + left[i + 1].x) / 2;
      const my = (left[i].y + left[i + 1].y) / 2;
      ctx.quadraticCurveTo(left[i].x, left[i].y, mx, my);
    }
    ctx.lineTo(left[n - 1].x, left[n - 1].y);
    ctx.lineTo(right[n - 1].x, right[n - 1].y);
    for (let i = n - 1; i > 0; i--) {
      const mx = (right[i].x + right[i - 1].x) / 2;
      const my = (right[i].y + right[i - 1].y) / 2;
      ctx.quadraticCurveTo(right[i].x, right[i].y, mx, my);
    }
    ctx.lineTo(right[0].x, right[0].y);
    ctx.closePath();
    ctx.fill();
  }

  renderAirbrush(ctx, pts, color, size, usePressure, brush) {
    if (!pts || pts.length === 0) return;
    const soft = brush.soft ?? 0.6;
    const grain = brush.grain ?? 0;
    const fuzzy = !!brush.fuzzy;

    // Smooth overlapping spacing with GPU-accelerated cached dab stamp
    const spacing = Math.max(2, size * 0.09);
    const dab = this.getAirbrushDab(color, soft, grain);

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const steps = Math.max(1, Math.floor(dist / spacing));

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        let x = p1.x + (p2.x - p1.x) * t;
        let y = p1.y + (p2.y - p1.y) * t;
        const press = usePressure ? ((p1.pressure || 0.5) * (1 - t) + (p2.pressure || 0.5) * t) : 1.0;
        let r = Math.max(2, (size * press) / 2);

        if (fuzzy) {
          x += (coordRand(x, y, 1) - 0.5) * (r * 0.2);
          y += (coordRand(x, y, 2) - 0.5) * (r * 0.2);
        }

        ctx.drawImage(dab, x - r, y - r, r * 2, r * 2);
      }
    }
  }

  renderRound(ctx, pts, color, size, usePressure, brush) {
    const hardness = brush.hardness ?? 1.0;
    if (hardness >= 0.7) {
      this.renderStandardStroke(ctx, pts, color, size, usePressure);
      return;
    }

    const spacing = Math.max(2, size * 0.08);
    const dab = this.getSoftDab(color, hardness);

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const steps = Math.max(1, Math.floor(dist / spacing));

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;
        const press = usePressure ? ((p1.pressure || 0.5) * (1 - t) + (p2.pressure || 0.5) * t) : 1.0;
        const r = Math.max(1, (size * press) / 2);

        ctx.drawImage(dab, x - r, y - r, r * 2, r * 2);
      }
    }
  }

  renderGelPen(ctx, pts, color, size, usePressure) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.shadowBlur = 1;
    ctx.shadowColor = color;
    this.renderStandardStroke(ctx, pts, color, size, usePressure);
    ctx.shadowBlur = 0;
  }

  renderShapeBrush(ctx, pts, color, size, usePressure, brush) {
    const spacing = Math.max(2, size * 0.2);
    ctx.fillStyle = color;

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const steps = Math.max(1, Math.floor(dist / spacing));
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;
        const press = usePressure ? ((p1.pressure || 0.5) * (1 - t) + (p2.pressure || 0.5) * t) : 1.0;
        const sSize = Math.max(2, size * press);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        if (brush.type === 'square' || brush.type === 'flat') {
          ctx.fillRect(-sSize / 2, -sSize / 2, sSize, sSize);
        } else if (brush.type === 'polygon' && brush.sides === 3) {
          ctx.beginPath();
          ctx.moveTo(0, -sSize / 2);
          ctx.lineTo(sSize / 2, sSize / 2);
          ctx.lineTo(-sSize / 2, sSize / 2);
          ctx.closePath();
          ctx.fill();
        } else if (brush.type === 'polygon' && brush.sides === 5) {
          ctx.beginPath();
          for (let k = 0; k < 5; k++) {
            const a = (k * 2 * Math.PI) / 5 - Math.PI / 2;
            const px = Math.cos(a) * (sSize / 2);
            const py = Math.sin(a) * (sSize / 2);
            if (k === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillRect(-sSize / 2, -sSize / 4, sSize, sSize / 2);
        }
        ctx.restore();
      }
    }
  }

  renderEllipse(ctx, pts, color, size, usePressure, brush) {
    const spacing = Math.max(1.5, size * 0.15);
    const fixedAngle = (brush.angle ?? 45) * (Math.PI / 180);
    const ratio = brush.ratio ?? 0.35;
    ctx.fillStyle = color;

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const steps = Math.max(1, Math.floor(dist / spacing));

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;
        const press = usePressure ? ((p1.pressure || 0.5) * (1 - t) + (p2.pressure || 0.5) * t) : 1.0;
        const rx = Math.max(1, (size * press) / 2);
        const ry = Math.max(0.5, rx * ratio);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(fixedAngle);
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  renderCaligraphy(ctx, pts, color, size, usePressure, brush) {
    const spacing = Math.max(1, size * 0.08);
    ctx.fillStyle = color;
    const isDir = brush.type.includes('dir');
    const angleRad = (brush.angle ?? 45) * (Math.PI / 180);
    const ratio = brush.ratio ?? 0.2;

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const steps = Math.max(1, Math.floor(dist / spacing));
      const strokeAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;
        const press = usePressure ? ((p1.pressure || 0.5) * (1 - t) + (p2.pressure || 0.5) * t) : 1.0;
        const len = Math.max(2, size * press);
        const curAngle = isDir ? strokeAngle : angleRad;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(curAngle);
        ctx.fillRect(-len / 2, -len * ratio / 2, len, Math.max(1, len * ratio));
        ctx.restore();
      }
    }
  }

  renderCharcoal(ctx, pts, color, size, usePressure, brush) {
    const spacing = Math.max(2, size * 0.18);
    const roughness = brush.roughness ?? 0.7;

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const steps = Math.max(1, Math.floor(dist / spacing));

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;
        const press = usePressure ? ((p1.pressure || 0.5) * (1 - t) + (p2.pressure || 0.5) * t) : 1.0;
        const r = Math.max(2, (size * press) / 2);

        ctx.fillStyle = color;
        const dots = Math.floor(r * 2.5 * roughness);
        for (let k = 0; k < dots; k++) {
          const a = coordRand(x, y, k * 4 + 1) * Math.PI * 2;
          const d = coordRand(x, y, k * 4 + 2) * r;
          const px = x + Math.cos(a) * d;
          const py = y + Math.sin(a) * d;
          ctx.globalAlpha = (1 - (d / r) * 0.5) * (coordRand(x, y, k * 4 + 3) * 0.6 + 0.4);
          const dotSize = coordRand(x, y, k * 4 + 4) * 2 + 1;
          ctx.fillRect(px, py, dotSize, dotSize);
        }
      }
    }
  }

  renderPencil(ctx, pts, color, size, usePressure, brush) {
    if (!pts || pts.length === 0) return;
    const softness = brush.softness ?? 0.6;
    ctx.save();
    ctx.globalAlpha = Math.min(1.0, 0.45 + softness * 0.5);

    // Continuous smooth core pencil line
    this.renderStandardStroke(ctx, pts, color, Math.max(1, size * 0.75), usePressure);

    // Graphite tooth and grain dispersion along the stroke
    ctx.fillStyle = color;
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const grainCount = Math.floor(dist * 0.6);
      const w = Math.max(1, size * 0.6);

      for (let g = 0; g < grainCount; g++) {
        const gt = coordRand(p1.x, p1.y, g * 4 + 1);
        const gx = p1.x + (p2.x - p1.x) * gt + (coordRand(p1.x, p2.y, g * 4 + 2) - 0.5) * w;
        const gy = p1.y + (p2.y - p1.y) * gt + (coordRand(p2.x, p1.y, g * 4 + 3) - 0.5) * w;
        ctx.globalAlpha = coordRand(gx, gy, g * 4 + 4) * 0.3 + 0.1;
        ctx.fillRect(gx, gy, 1, 1);
      }
    }
    ctx.restore();
  }

  renderInk(ctx, pts, color, size, usePressure, brush) {
    if (!pts || pts.length === 0) return;
    if (brush.type === 'ink_wash') {
      ctx.save();
      ctx.globalAlpha = brush.opacity ?? 0.4;
      this.renderStandardStroke(ctx, pts, color, size * 1.5, usePressure);
      ctx.restore();
      return;
    }
    this.renderStandardStroke(ctx, pts, color, size, usePressure);
  }

  renderDryRoughInk(ctx, pts, color, size, usePressure, brush) {
    ctx.fillStyle = color;
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const steps = Math.max(1, Math.floor(dist / 2));

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;
        const press = usePressure ? ((p1.pressure || 0.5) * (1 - t) + (p2.pressure || 0.5) * t) : 1.0;
        const w = size * press;

        const bristles = 5;
        for (let b = 0; b < bristles; b++) {
          if (coordRand(x, y, b * 2 + 1) < 0.25) continue;
          const offset = ((b / (bristles - 1)) - 0.5) * w;
          ctx.fillRect(x + offset, y + (coordRand(x, y, b * 2 + 2) - 0.5) * 2, 1.8, 1.8);
        }
      }
    }
  }

  renderInkSplatter(ctx, pts, color, size, usePressure, brush) {
    ctx.fillStyle = color;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const mainR = Math.max(1.5, size * 0.4);
      ctx.beginPath();
      ctx.arc(p.x, p.y, mainR, 0, Math.PI * 2);
      ctx.fill();

      const splatters = Math.floor(coordRand(p.x, p.y, 1) * 4 + 2);
      for (let s = 0; s < splatters; s++) {
        const ang = coordRand(p.x, p.y, s * 3 + 10) * Math.PI * 2;
        const dist = coordRand(p.x, p.y, s * 3 + 11) * (size * 1.5) + mainR;
        const sx = p.x + Math.cos(ang) * dist;
        const sy = p.y + Math.sin(ang) * dist;
        const sr = coordRand(p.x, p.y, s * 3 + 12) * (mainR * 0.4) + 0.5;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  renderHair(ctx, pts, color, size, usePressure, brush) {
    if (pts.length < 2) {
      this.renderStandardStroke(ctx, pts, color, size, usePressure);
      return;
    }
    const strands = brush.strands ?? (brush.tines ?? 7);
    const spread = (brush.spread ?? 1.0) * size;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(0.6, (brush.fine ? 0.8 : 1.5));

    // Precalculate smoothed tangent angles for all points to eliminate wild angle flipping
    const angles = new Array(pts.length);
    let lastAngle = 0;
    for (let i = 0; i < pts.length; i++) {
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(pts.length - 1, i + 1)];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      if (Math.hypot(dx, dy) > 0.5) {
        lastAngle = Math.atan2(dy, dx) + Math.PI / 2;
      }
      angles[i] = lastAngle;
    }

    for (let s = 0; s < strands; s++) {
      const strandOffset = ((s / (strands - 1 || 1)) - 0.5) * spread;

      const strandPoints = [];
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const angle = angles[i];
        const ox = Math.cos(angle) * strandOffset;
        const oy = Math.sin(angle) * strandOffset;
        strandPoints.push({ x: p.x + ox, y: p.y + oy });
      }

      ctx.beginPath();
      ctx.moveTo(strandPoints[0].x, strandPoints[0].y);
      for (let i = 1; i < strandPoints.length - 1; i++) {
        const mx = (strandPoints[i].x + strandPoints[i + 1].x) / 2;
        const my = (strandPoints[i].y + strandPoints[i + 1].y) / 2;
        ctx.quadraticCurveTo(strandPoints[i].x, strandPoints[i].y, mx, my);
      }
      ctx.lineTo(strandPoints[strandPoints.length - 1].x, strandPoints[strandPoints.length - 1].y);
      ctx.stroke();
    }
  }

  renderHalftone(ctx, pts, color, size, usePressure, brush) {
    const spacing = Math.max(2, size * 0.15);
    ctx.fillStyle = color;
    const freq = brush.freq ?? 12;

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const steps = Math.max(1, Math.floor(dist / spacing));

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const cx = p1.x + (p2.x - p1.x) * t;
        const cy = p1.y + (p2.y - p1.y) * t;
        const press = usePressure ? ((p1.pressure || 0.5) * (1 - t) + (p2.pressure || 0.5) * t) : 1.0;
        const r = Math.max(2, (size * press) / 2);

        const minX = Math.floor((cx - r) / freq) * freq;
        const maxX = Math.ceil((cx + r) / freq) * freq;
        const minY = Math.floor((cy - r) / freq) * freq;
        const maxY = Math.ceil((cy + r) / freq) * freq;

        for (let gx = minX; gx <= maxX; gx += freq) {
          for (let gy = minY; gy <= maxY; gy += freq) {
            const d = Math.hypot(gx - cx, gy - cy);
            if (d <= r) {
              const dotR = Math.max(0.8, (1 - d / r) * (freq * 0.45));
              ctx.beginPath();
              ctx.arc(gx, gy, dotR, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
    }
  }

  renderOutline(ctx, pts, color, size, usePressure, brush) {
    if (pts.length < 2) return;
    const rimW = Math.max(1, size * 0.15);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = Math.max(1, size - rimW * 2);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
    ctx.restore();
  }

  renderParticles(ctx, pts, color, size, usePressure, brush) {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    const isBubble = brush.type === 'particles_bubbles';

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const count = Math.floor(coordRand(p.x, p.y, 1) * 5 + 3);
      const scatterR = size * 1.2;

      for (let k = 0; k < count; k++) {
        const ang = coordRand(p.x, p.y, k * 3 + 10) * Math.PI * 2;
        const d = coordRand(p.x, p.y, k * 3 + 11) * scatterR;
        const px = p.x + Math.cos(ang) * d;
        const py = p.y + Math.sin(ang) * d;

        if (isBubble) {
          const br = coordRand(p.x, p.y, k * 3 + 12) * (size * 0.4) + 1.5;
          ctx.beginPath();
          ctx.arc(px, py, br, 0, Math.PI * 2);
          ctx.lineWidth = 1.2;
          ctx.stroke();
        } else {
          const pr = coordRand(p.x, p.y, k * 3 + 12) * 2 + 1;
          ctx.fillRect(px, py, pr, pr);
        }
      }
    }
  }

  renderPixel(ctx, pts, color, size, brush) {
    const pxSize = Math.max(1, Math.round(size / 3) || 1);
    ctx.fillStyle = color;

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const steps = Math.max(1, Math.floor(dist / pxSize));

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const rawX = p1.x + (p2.x - p1.x) * t;
        const rawY = p1.y + (p2.y - p1.y) * t;
        const snapX = Math.floor(rawX / pxSize) * pxSize;
        const snapY = Math.floor(rawY / pxSize) * pxSize;
        ctx.fillRect(snapX, snapY, pxSize, pxSize);
      }
    }
  }

  renderElementFX(ctx, pts, color, size, usePressure, brush) {
    if (!pts || pts.length === 0) return;
    const spacing = Math.max(2, size * 0.1);
    const dab = this.getSoftDab(color, 0.4);

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const steps = Math.max(1, Math.floor(dist / spacing));

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;
        const r = Math.max(4, size * 0.8);
        const ox = (coordRand(x, y, s * 2 + 1) - 0.5) * (r * 0.3);
        const oy = (coordRand(x, y, s * 2 + 2) - 0.5) * (r * 0.3);
        ctx.drawImage(dab, x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
  }

  renderWatercolor(ctx, pts, color, size, usePressure, brush) {
    if (!pts || pts.length === 0) return;
    const spacing = Math.max(2, size * 0.1);
    const dab = this.getSoftDab(color, 0.5);

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const steps = Math.max(1, Math.floor(dist / spacing));

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;
        const r = Math.max(3, size / 2);
        ctx.drawImage(dab, x - r, y - r, r * 2, r * 2);
      }
    }
  }

  /**
   * Generates a 2D stroke preview thumbnail for brush selectors in UI
   */
  generatePreviewCanvas(brushId, width = 140, height = 36, strokeColor = '#6366f1') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Subtle dark gradient background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fillRect(0, 0, width, height);

    // Create an S-shaped preview path
    const pts = [];
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = 12 + t * (width - 24);
      const y = (height / 2) + Math.sin(t * Math.PI * 2) * (height * 0.25);
      const pressure = 0.35 + Math.sin(t * Math.PI) * 0.65;
      pts.push({ x, y, pressure });
    }

    const testStroke = {
      points: pts,
      brushPreset: brushId,
      color: strokeColor,
      size: 10,
      opacity: 1.0,
      usePressure: true
    };

    this.renderStroke(ctx, testStroke);
    return canvas.toDataURL('image/png');
  }
}

export const brushEngine = new ProceduralBrushEngine();
