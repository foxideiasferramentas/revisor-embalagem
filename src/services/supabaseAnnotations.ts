/**
 * Exemplo de serviço de persistência de anotações usando o cliente Supabase (@supabase/supabase-js).
 */
import type { Annotation } from '../types/packaging';

// Em um projeto real, importe o cliente configurado:
// import { supabase } from '../lib/supabaseClient';

export async function fetchAnnotationsByPdf(supabaseClient: any, pdfId: string): Promise<Annotation[]> {
  const { data, error } = await supabaseClient
    .from('pdf_annotations')
    .select('*')
    .eq('pdf_id', pdfId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Falha ao buscar anotações: ${error.message}`);
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    pdf_id: row.pdf_id,
    user_id: row.user_id,
    content: row.content,
    x_coord: Number(row.x_coord),
    y_coord: Number(row.y_coord),
    status: row.status,
    created_at: row.created_at,
  }));
}

export async function saveAnnotation(
  supabaseClient: any,
  annotation: Omit<Annotation, 'id' | 'created_at'>
): Promise<Annotation> {
  const { data, error } = await supabaseClient
    .from('pdf_annotations')
    .insert([
      {
        pdf_id: annotation.pdf_id,
        user_id: annotation.user_id,
        content: annotation.content,
        x_coord: annotation.x_coord,
        y_coord: annotation.y_coord,
        status: annotation.status,
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Falha ao salvar anotação: ${error.message}`);
  }

  return data;
}

export async function updateAnnotationStatus(
  supabaseClient: any,
  id: string,
  status: 'approved' | 'rejected' | 'pending'
): Promise<void> {
  const { error } = await supabaseClient
    .from('pdf_annotations')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    throw new Error(`Falha ao atualizar status: ${error.message}`);
  }
}
