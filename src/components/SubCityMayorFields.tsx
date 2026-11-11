"use client";
import { useState } from "react";

type Sub = { id: string; name: string; mayorName: string | null };

/**
 * Sub-city drop-down plus the "Sub-city mayor" field. Choosing a sub-city fills in
 * its current mayor; editing the name updates the mayor for that sub-city.
 */
export function SubCityMayorFields({ subCities, defaultSubCityId, compact }: { subCities: Sub[]; defaultSubCityId?: string | null; compact?: boolean }) {
  const initial = subCities.find((s) => s.id === defaultSubCityId);
  const [subCityId, setSubCityId] = useState(defaultSubCityId ?? "");
  const [mayor, setMayor] = useState(initial?.mayorName ?? "");

  const subSelect = (
    <select
      name="subCityId"
      value={subCityId}
      onChange={(e) => {
        setSubCityId(e.target.value);
        setMayor(subCities.find((s) => s.id === e.target.value)?.mayorName ?? "");
      }}
      className="input"
    >
      <option value="">— City level (no sub-city) —</option>
      {subCities.map((s) => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
    </select>
  );
  const mayorInput = (
    <input
      name="subCityMayor"
      value={mayor}
      onChange={(e) => setMayor(e.target.value)}
      disabled={!subCityId}
      placeholder={subCityId ? "Name of the sub-city mayor" : "Choose a sub-city first"}
      className="input disabled:bg-slate-50"
    />
  );

  if (compact)
    return (
      <>
        {subSelect}
        {mayorInput}
      </>
    );
  return (
    <>
      <label className="block">
        <span className="label">Sub-city</span>
        {subSelect}
      </label>
      <label className="block">
        <span className="label">Sub-city mayor</span>
        {mayorInput}
      </label>
    </>
  );
}
