import { initialsOf } from "./susu";

const DIRECTORY = [
  { id: "d1", name: "Ama Boateng", phone: "+233 244 123 4567", avatarColor: "#3b82f6" },
  { id: "d2", name: "Kofi Mensah", phone: "+233 244 555 9876", avatarColor: "#10b981" },
  { id: "d3", name: "Sarah Johnson", phone: "+233 244 555 4321", avatarColor: "#8b5cf6" },
  { id: "d4", name: "Kwame Asante", phone: "+233 244 555 1357", avatarColor: "#f97316" },
  { id: "d5", name: "Ama Aboagye", phone: "+233 244 555 2468", avatarColor: "#ec4899" },
  { id: "d6", name: "Daniel Osei", phone: "+233 244 555 1111", avatarColor: "#14b8a6" },
  { id: "d7", name: "Fatima Al-Hassan", phone: "+233 244 555 1358", avatarColor: "#06b6d4" },
  { id: "d8", name: "Michael Brown", phone: "+233 244 555 8765", avatarColor: "#84cc16" },
];

const normalize = (value) => String(value || "").replace(/[\s\-()]/g, "").toLowerCase();

export function searchDirectory(query, { excludePhones = [] } = {}) {
  const excluded = new Set(excludePhones.filter(Boolean).map(normalize));
  const term = normalize(query);

  return DIRECTORY
    .filter((person) => !excluded.has(normalize(person.phone)))
    .filter((person) => !term || normalize(person.name).includes(term) || normalize(person.phone).includes(term))
    .map((person) => ({ ...person, initials: initialsOf(person.name) }));
}

export { DIRECTORY };