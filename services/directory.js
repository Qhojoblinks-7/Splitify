import { initialsOf } from "./susu";
import colors from "../theme/colors";

const DIRECTORY = [
  { id: "d1", name: "Ama Boateng", phone: "+233 244 123 4567", avatarColor: colors.avatarBlue },
  { id: "d2", name: "Kofi Mensah", phone: "+233 244 555 9876", avatarColor: colors.avatarGreen },
  { id: "d3", name: "Sarah Johnson", phone: "+233 244 555 4321", avatarColor: colors.avatarViolet },
  { id: "d4", name: "Kwame Asante", phone: "+233 244 555 1357", avatarColor: colors.amber },
  { id: "d5", name: "Ama Aboagye", phone: "+233 244 555 2468", avatarColor: colors.avatarPink },
  { id: "d6", name: "Daniel Osei", phone: "+233 244 555 1111", avatarColor: colors.avatarTeal },
  { id: "d7", name: "Fatima Al-Hassan", phone: "+233 244 555 1358", avatarColor: colors.avatarCyan },
  { id: "d8", name: "Michael Brown", phone: "+233 244 555 8765", avatarColor: colors.avatarLime },
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