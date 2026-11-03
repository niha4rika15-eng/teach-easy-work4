import { imageQueryVariants, searchStockImage } from '../../../lib/stock-images'
;(async () => { for (const q of ['molecular structure of ATP and Chlorophyll', 'classroom discussion icon', 'photosynthesis chemical equation diagram']) { console.log(q, imageQueryVariants(q)); const r = await searchStockImage(q); console.log(' ->', r?.title ?? 'none') } })()
