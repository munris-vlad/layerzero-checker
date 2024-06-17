import {
    getKeyByValue,
    readWallets
} from './utils/common.js'
import { Table } from 'console-table-printer'
import { createObjectCsvWriter } from 'csv-writer'
import cliProgress from 'cli-progress'
import Papa from "papaparse"
import fs from "fs"

let columns = [
    { name: 'n', color: 'green', alignment: "right" },
    { name: 'wallet', color: 'green', alignment: "right" },
    { name: 'sybil', color: 'green', alignment: "right" },
    { name: 'cluster', color: 'green', alignment: "right" },
    { name: 'source', color: 'green', alignment: "right" },
]

let headers = [
    { id: 'n', title: '№' },
    { id: 'wallet', title: 'wallet' },
    { id: 'sybil', title: 'sybil' },
    { id: 'cluster', title: 'cluster' },
    { id: 'source', title: 'source' },
]

let p
let csvWriter
let wallets = readWallets('./addresses.txt')
let iterations = wallets.length
let iteration = 1
let stats = []
let data = []
let csvData = []
const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)

const csvFile = fs.readFileSync('./data/data.csv', 'utf8')

Papa.parse(csvFile, {
    header: true,
    complete: function(results) {
        results.data.forEach(row => {
            if (row.Line) {
                data[row.Line.toLowerCase()] = {
                    sybil: true,
                    cluster: row['File Name'],
                    source: row['Folder Name']
                }
            }
        })
    }
})

async function checkSybil(wallet) {
    stats[wallet].sybil = false

    stats[wallet] = {
        sybil: data[wallet.toLowerCase()] ? true : false,
        cluster: data[wallet.toLowerCase()] ? data[wallet.toLowerCase()].cluster : null,
        source: data[wallet.toLowerCase()] ? data[wallet.toLowerCase()].source : null
    }
}

async function fetchWallet(wallet, index) {
    stats[wallet] = {
        sybil: false
    }

    await checkSybil(wallet)

    progressBar.update(iteration)

    let row = {
        n: parseInt(index) + 1,
        wallet: wallet,
        sybil: stats[wallet].sybil,
        cluster: stats[wallet].cluster,
        source: stats[wallet].source
    }

    p.addRow(row, { color: "cyan" })

    iteration++
}

async function fetchWallets() {
    iterations = wallets.length
    iteration = 1
    csvData = []


    let batchSize = 100
    let timeout = 1000

    const batchCount = Math.ceil(wallets.length / batchSize)
    const walletPromises = []

    p = new Table({
        columns: columns,
        sort: (row1, row2) => +row1.n - +row2.n
    })

    csvWriter = createObjectCsvWriter({
        path: './result.csv',
        header: headers
    })

    for (let i = 0; i < batchCount; i++) {
        const startIndex = i * batchSize
        const endIndex = (i + 1) * batchSize
        const batch = wallets.slice(startIndex, endIndex)

        const promise = new Promise((resolve) => {
            setTimeout(() => {
                resolve(fetchBatch(batch))
            }, i * timeout)
        })

        walletPromises.push(promise)
    }

    await Promise.all(walletPromises)
    return true
}

async function fetchBatch(batch) {
    await Promise.all(batch.map((account, index) => fetchWallet(account, getKeyByValue(wallets, account))))
}

async function saveToCsv() {
    p.table.rows.map((row) => {
        csvData.push(row.text)
    })
    csvData.sort((a, b) => a.n - b.n)
    csvWriter.writeRecords(csvData).then().catch()
}

async function addTotalRow() {
    p.addRow({})
    const sybilCount = Object.entries(stats).filter(([key, value]) => value.sybil === true).length
    const walletsCount = wallets.length

    let row = {
        wallet: 'Total sybil count',
        sybil: `${sybilCount} / ${walletsCount} (${((sybilCount / walletsCount) * 100).toFixed(0)}%)`
    }

    p.addRow(row, { color: "cyan" })
}

export async function layerzeroSybilChecker() {
    progressBar.start(iterations, 0)
    await fetchWallets()
    await addTotalRow()
    await saveToCsv()
    progressBar.stop()
    p.printTable()
}