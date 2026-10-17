// Point d'entrée sans DOM ni React (API, moteur d'export, commerce).
export { createSpec, parseSpec } from './defaults.ts'
export { PosterSpecSchema, MAP_STYLE_IDS, STAT_KEYS, type PosterSpec, type MapStyleId, type StatKey } from './spec.ts'
export { PAPER_SIZES, pageGeometry, exportPixels, CSS_PX_PER_MM, type PaperSizeId, type PageGeometry, type Orientation } from './formats.ts'
export { TEMPLATE_META, TEMPLATE_IDS, templateMeta, type TemplateMeta, type TemplateId } from './templates/catalog.ts'
export { STAT_LABELS, formatStat, formatDuration, defaultStats } from './values.ts'
