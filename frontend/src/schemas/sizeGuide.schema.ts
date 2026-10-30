import { z } from 'zod';

export const FootwearSizeGuideSchema = z.object({
  tipo: z.literal('CALZADO'),
  talles: z.array(z.object({
    talle_ar: z.number(),
    talle_eur: z.number(),
    talle_us: z.number(),
    largo_plantilla_cm: z.number()
  }))
});

export const TopsSizeGuideSchema = z.object({
  tipo: z.literal('PARTE_SUPERIOR'),
  talles: z.array(z.object({
    talle: z.string(),
    ancho_pecho_cm: z.number(),
    largo_total_cm: z.number(),
    largo_manga_cm: z.number(),
    ancho_hombro_cm: z.number()
  }))
});

export const BottomsSizeGuideSchema = z.object({
  tipo: z.literal('PARTE_INFERIOR'),
  talles: z.array(z.object({
    talle: z.string(),
    contorno_cintura_cm: z.number(),
    contorno_cadera_cm: z.number(),
    tiro_delantero_cm: z.number(),
    largo_entrepierna_cm: z.number()
  }))
});
