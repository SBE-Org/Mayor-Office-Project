"use client";
import { useState } from "react";
import clsx from "clsx";

export type LocationTree = { id: string; name: string; woredas: { id: string; name: string; kebeles: { id: string; name: string }[] }[] }[];

type Props = {
  tree: LocationTree;
  labels?: { subCity?: string; woreda?: string; kebele?: string };
  defaults?: { subCityId?: string | null; woreda?: string | null; kebele?: string | null };
  required?: boolean;
  /** Wrapper class for each field (e.g. grid column span). */
  fieldClassName?: string;
};

/**
 * Sub-city → Woreda → Kebele drop-downs. The lists are maintained by the
 * administrator under "Sub-cities, woredas & kebeles". Submits
 * subCityId (id), woreda (name) and kebele (name).
 */
export function LocationPicker({ tree, labels, defaults, required, fieldClassName }: Props) {
  const [subCityId, setSubCityId] = useState(defaults?.subCityId ?? "");
  const [woreda, setWoreda] = useState(defaults?.woreda ?? "");
  const [kebele, setKebele] = useState(defaults?.kebele ?? "");

  const sc = tree.find((s) => s.id === subCityId);
  const w = sc?.woredas.find((x) => x.name === woreda);

  return (
    <>
      <label className={clsx("block", fieldClassName)}>
        <span className="label">{labels?.subCity ?? "Sub-city"}</span>
        <select
          name="subCityId"
          value={subCityId}
          required={required}
          onChange={(e) => {
            setSubCityId(e.target.value);
            setWoreda("");
            setKebele("");
          }}
          className="input"
        >
          <option value="">—</option>
          {tree.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </label>
      <label className={clsx("block", fieldClassName)}>
        <span className="label">{labels?.woreda ?? "Woreda"}</span>
        <select
          name="woreda"
          value={woreda}
          required={required && !!sc?.woredas.length}
          disabled={!sc || !sc.woredas.length}
          onChange={(e) => {
            setWoreda(e.target.value);
            setKebele("");
          }}
          className="input disabled:bg-slate-50 disabled:text-slate-400"
        >
          <option value="">{!sc ? "Choose sub-city first" : sc.woredas.length ? "—" : "No woredas registered"}</option>
          {sc?.woredas.map((x) => (
            <option key={x.id} value={x.name}>{x.name}</option>
          ))}
        </select>
      </label>
      <label className={clsx("block", fieldClassName)}>
        <span className="label">{labels?.kebele ?? "Kebele"}</span>
        <select
          name="kebele"
          value={kebele}
          required={required && !!w?.kebeles.length}
          disabled={!w || !w.kebeles.length}
          onChange={(e) => setKebele(e.target.value)}
          className="input disabled:bg-slate-50 disabled:text-slate-400"
        >
          <option value="">{!w ? "Choose woreda first" : w.kebeles.length ? "—" : "No kebeles registered"}</option>
          {w?.kebeles.map((k) => (
            <option key={k.id} value={k.name}>{k.name}</option>
          ))}
        </select>
      </label>
    </>
  );
}
