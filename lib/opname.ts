import type { Role } from "@/lib/data";

export type StaffRole = Exclude<Role, "Owner">;
export type OpnameInputType = "primary" | "secondary";
export type OpnameAssignment = {
  role: StaffRole;
  areaName: string;
  inputType: OpnameInputType;
};

const roleAreas: Record<StaffRole, string> = {
  Cheef: "Dapur",
  Waiters: "Service / Packaging",
  Kasir: "Kasir",
};

const roleKeywordRules: Array<{ role: StaffRole; keywords: string[] }> = [
  {
    role: "Kasir",
    keywords: ["kertas", "nota", "bolpoint", "pulpen", "alat tulis", "kasir", "struk"],
  },
  {
    role: "Waiters",
    keywords: ["minuman", "teh", "air", "galon", "gelas", "bowl", "mangkuk", "plastik", "packaging", "service"],
  },
  {
    role: "Cheef",
    keywords: [
      "dapur",
      "protein",
      "daging",
      "sayur",
      "bumbu",
      "rempah",
      "olahan",
      "masak",
      "ayam",
      "telur",
      "sapi",
    ],
  },
];

function categoryFallback(category: string): StaffRole {
  const normalized = category.toLowerCase();
  if (/(minuman|plastik|packaging|service)/i.test(normalized)) return "Waiters";
  if (/(kertas|nota|kasir|alat tulis)/i.test(normalized)) return "Kasir";
  return "Cheef";
}

export function getOpnameAssignments(input: { name: string; category: string }): OpnameAssignment[] {
  const text = `${input.category} ${input.name}`.toLowerCase();
  const matchedRoles = roleKeywordRules
    .filter((rule) => rule.keywords.some((keyword) => text.includes(keyword)))
    .map((rule) => rule.role);
  const roles = Array.from(new Set(matchedRoles.length ? matchedRoles : [categoryFallback(input.category)]));

  return roles.map((role, index) => ({
    role,
    areaName: roleAreas[role],
    inputType: index === 0 ? "primary" : "secondary",
  }));
}

export function roleCanInputIngredient(role: Role, input: { name: string; category: string }) {
  if (role === "Owner") return true;
  return getOpnameAssignments(input).some((assignment) => assignment.role === role);
}

export function getPrimaryOpnameRole(input: { name: string; category: string }) {
  return getOpnameAssignments(input)[0]?.role ?? "Cheef";
}
