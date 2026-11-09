import { z } from 'zod';
import { COMPANIONS } from '../shared/types.js';
export const uuidSchema=z.string().uuid();
export const loginSchema=z.object({email:z.string().trim().toLowerCase().email().max(254),code:z.string().regex(/^\d{4}$/)}).strict();
const base={companion:z.enum(COMPANIONS),duration:z.enum(['day','overnight']),tripStyle:z.enum(['slow','active'])};
export const settingsSchema=z.object({...base,visitedSpotIds:z.array(uuidSchema).max(100)}).strict();
export const saveSchema=z.object({
  revision:z.number().int().positive(),...base,template:z.enum(['colorful','postcard']),
  items:z.array(z.object({id:uuidSchema,selected:z.boolean(),isMemory:z.boolean(),order:z.number().int().min(0).max(999),
    comment:z.string().refine(v=>[...v].length<=200,'コメントは200字以内にしてください。')}).strict()).min(1).max(1000),
}).strict();
export const regenerationSchema=z.object({draft:saveSchema,settings:settingsSchema,mode:z.enum(['all','candidates'])}).strict();

