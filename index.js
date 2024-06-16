import { layerzeroSybilChecker } from "./checker.js"
import { entryPoint } from "./utils/common.js"

async function startMenu(menu) {
    await layerzeroSybilChecker()
}

await startMenu()
