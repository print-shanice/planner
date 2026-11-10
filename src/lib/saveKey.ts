import { supabase } from './supabase'

// the key an apple shortcut uses to save links from the share sheet (see save_keys in schema.sql)
export async function hasSaveKey(): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_save_key')
  if (error) throw new Error(error.message)
  return data === true
}

export async function newSaveKey(): Promise<string> {
  const { data, error } = await supabase.rpc('new_save_key')
  if (error || typeof data !== 'string') throw new Error(error?.message ?? 'no key')
  return data
}
