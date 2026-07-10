import React from 'react';
import LeylekAIFloating from '../components/LeylekAIFloating';

/** Rol seçimi — Leylek Zeka ipucu (app/index.tsx rol alanında kullanılır). */
export function RoleSelectLeylekAIFloating() {
  return (
    <LeylekAIFloating
      position="center-bottom"
      visualPreset="roleCockpit"
      message="Leylek Zeka’ya sor; adımları birlikte netleştirelim."
    />
  );
}
