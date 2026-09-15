import { useState, useEffect } from 'react';
import { PackagingViewer } from './components/PackagingViewer';
import type { FileItem } from './components/PackagingViewer/PackagingViewer';

export default function App() {
  const [fileA, setFileA] = useState<FileItem | null>(null);
  const [fileB, setFileB] = useState<FileItem | null>(null);

  // Limpeza de Object URLs quando os arquivos são substituídos ou o componente desmontado
  useEffect(() => {
    return () => {
      if (fileA?.url.startsWith('blob:')) URL.revokeObjectURL(fileA.url);
      if (fileB?.url.startsWith('blob:')) URL.revokeObjectURL(fileB.url);
    };
  }, [fileA, fileB]);

  const handleSelectFileA = (file: File) => {
    if (fileA?.url.startsWith('blob:')) {
      URL.revokeObjectURL(fileA.url);
    }
    const blobUrl = URL.createObjectURL(file);
    setFileA({
      name: file.name,
      url: blobUrl,
      size: file.size,
    });
  };

  const handleSelectFileB = (file: File) => {
    if (fileB?.url.startsWith('blob:')) {
      URL.revokeObjectURL(fileB.url);
    }
    const blobUrl = URL.createObjectURL(file);
    setFileB({
      name: file.name,
      url: blobUrl,
      size: file.size,
    });
  };

  // Carrega arquivos de exemplo para demonstração imediata
  const handleLoadSampleFiles = () => {
    setFileA({
      name: 'Embalagem_Suco_V1_Aprovada.pdf',
      url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf',
      size: 1048576,
    });
    setFileB({
      name: 'Embalagem_Suco_V2_Revisao_Grafica.pdf',
      url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf',
      size: 1052300,
    });
  };

  return (
    <div className="w-full h-full">
      <PackagingViewer
        primaryPdf={fileA}
        comparisonPdf={fileB}
        onSelectFileA={handleSelectFileA}
        onSelectFileB={handleSelectFileB}
        onLoadSampleFiles={handleLoadSampleFiles}
      />
    </div>
  );
}
