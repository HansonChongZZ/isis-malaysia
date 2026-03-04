import Papa from "papaparse"
import * as fs from "fs"
import * as path from "path"

const DATA_DIR = path.join(process.cwd(), "data")
const OUT_DIR = path.join(process.cwd(), "public", "data")

function readCsv<T>(filename: string): T[] {
  const content = fs.readFileSync(path.join(DATA_DIR, filename), "utf8")
  const result = Papa.parse<T>(content, { header: true, skipEmptyLines: true, dynamicTyping: true })
  return result.data
}

interface NodeRow {
  code: number | string
  occupation: string
  AI_exposure_index: number | string
  quartile: string
  wage: number | string | null
  no_of_workers: number | string | null
}

interface EdgeRow {
  from: number | string
  to: number | string
  weight: number | string
}

interface SkillRow {
  code: number | string
  skills: string
  skill_type: string
}

interface TaskRow {
  code: number | string
  occupation: string
  tasks: string
  score: number | string
}

type Quartile = "Low" | "Medium low" | "Medium high" | "High"

function isValidQuartile(v: string): v is Quartile {
  return ["Low", "Medium low", "Medium high", "High"].includes(v)
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const nodeRows = readCsv<NodeRow>("nodelist.csv")
  const edgeRows = readCsv<EdgeRow>("edgelist_conditional.csv")
  const skillRows = readCsv<SkillRow>("masco-4d_with_skills.csv")
  const taskRows = readCsv<TaskRow>("masco-4d_with_tasks_and_scores__GPT4o_.csv")

  // Load existing nodes.json to preserve pre-computed x/y positions
  const existingNodesPath = path.join(OUT_DIR, "nodes.json")
  const existingPositions: Record<string, { x: number; y: number }> = {}
  if (fs.existsSync(existingNodesPath)) {
    const existing = JSON.parse(fs.readFileSync(existingNodesPath, "utf8")) as { id: string; x?: number; y?: number }[]
    for (const n of existing) {
      if (n.x !== undefined && n.y !== undefined) {
        existingPositions[n.id] = { x: n.x, y: n.y }
      }
    }
  }

  // Build nodes.json
  const nodes = nodeRows.map((row) => {
    const code = String(row.code).trim()
    const group = parseInt(code[0], 10)
    const aiExposure = typeof row.AI_exposure_index === "number" ? row.AI_exposure_index : parseFloat(String(row.AI_exposure_index))
    const wage = row.wage === null || row.wage === "NA" || row.wage === "" ? null : Number(row.wage)
    const workers = row.no_of_workers === null || row.no_of_workers === "NA" || row.no_of_workers === "" ? null : Number(row.no_of_workers)
    const quartile = isValidQuartile(row.quartile) ? row.quartile : "Medium low"
    const pos = existingPositions[code] ?? { x: Math.random(), y: Math.random() }
    return {
      id: code,
      label: row.occupation,
      group,
      aiExposure: isNaN(aiExposure) ? 0 : aiExposure,
      quartile,
      wage,
      workers: isNaN(workers as number) ? null : workers,
      x: pos.x,
      y: pos.y,
    }
  })

  // Build edges.json
  const edges = edgeRows
    .map((row) => ({
      source: String(row.from).trim(),
      target: String(row.to).trim(),
      weight: Number(row.weight),
    }))
    .filter((e) => e.weight >= 1 && e.weight <= 7)

  // Build skills lookup
  const skillsByCode: Record<string, { basic: string[]; specific: string[] }> = {}
  for (const row of skillRows) {
    const code = String(row.code).trim()
    if (!skillsByCode[code]) skillsByCode[code] = { basic: [], specific: [] }
    const skillName = String(row.skills).trim()
    if (row.skill_type === "basic_skills") {
      skillsByCode[code].basic.push(skillName)
    } else {
      skillsByCode[code].specific.push(skillName)
    }
  }

  // Build tasks lookup
  const tasksByCode: Record<string, { description: string; score: number }[]> = {}
  for (const row of taskRows) {
    const code = String(row.code).trim()
    if (!tasksByCode[code]) tasksByCode[code] = []
    const desc = String(row.tasks).trim()
    const score = typeof row.score === "number" ? row.score : parseFloat(String(row.score))
    if (desc) {
      tasksByCode[code].push({ description: desc, score: isNaN(score) ? 0 : score })
    }
  }

  // Build occupations.json
  const occupations: Record<string, object> = {}
  for (const node of nodes) {
    const skills = skillsByCode[node.id] ?? { basic: [], specific: [] }
    const tasks = tasksByCode[node.id] ?? []
    occupations[node.id] = {
      occupation: node.label,
      aiExposure: node.aiExposure,
      quartile: node.quartile,
      wage: node.wage,
      basicSkills: skills.basic,
      specificSkills: skills.specific,
      tasks,
    }
  }

  fs.writeFileSync(path.join(OUT_DIR, "nodes.json"), JSON.stringify(nodes, null, 2))
  fs.writeFileSync(path.join(OUT_DIR, "edges.json"), JSON.stringify(edges, null, 2))
  fs.writeFileSync(path.join(OUT_DIR, "occupations.json"), JSON.stringify(occupations, null, 2))

  console.log(`✓ nodes.json — ${nodes.length} nodes`)
  console.log(`✓ edges.json — ${edges.length} edges`)
  console.log(`✓ occupations.json — ${Object.keys(occupations).length} occupations`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
