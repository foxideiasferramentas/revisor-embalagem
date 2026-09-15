-- ==============================================================================
-- SCHEMA SUPABASE: ANOTAÇÕES TÉCNICAS PARA APROVAÇÃO DE EMBALAGENS
-- ==============================================================================

-- 1. Criação do Tipo Enumerado para Status de Aprovação
CREATE TYPE annotation_status AS ENUM ('pending', 'approved', 'rejected');

-- 2. Criação da Tabela de Anotações
CREATE TABLE public.pdf_annotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pdf_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    -- Coordenadas salvas em porcentagem (0.0000% a 100.0000%) para independência de zoom/escala
    x_coord NUMERIC(7, 4) NOT NULL CHECK (x_coord >= 0 AND x_coord <= 100),
    y_coord NUMERIC(7, 4) NOT NULL CHECK (y_coord >= 0 AND y_coord <= 100),
    status annotation_status DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Índices de Performance
CREATE INDEX idx_pdf_annotations_pdf_id ON public.pdf_annotations(pdf_id);
CREATE INDEX idx_pdf_annotations_status ON public.pdf_annotations(status);

-- 4. Habilitação de Segurança em Nível de Linha (Row Level Security - RLS)
ALTER TABLE public.pdf_annotations ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso:
-- Visualização: Usuários autenticados podem ver anotações de qualquer documento
CREATE POLICY "Permitir leitura para usuários autenticados"
ON public.pdf_annotations
FOR SELECT
TO authenticated
USING (true);

-- Criação: Usuários autenticados podem adicionar novas anotações
CREATE POLICY "Permitir inserção para usuários autenticados"
ON public.pdf_annotations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Atualização: Usuários podem editar anotações ou mudar status de aprovação
CREATE POLICY "Permitir atualização de anotações"
ON public.pdf_annotations
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
