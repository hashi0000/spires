"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pdfText = pdfText;
/** Text extraction for uncompressed PDFKit test fixtures, including embedded ToUnicode fonts. */
function pdfText(bytes) {
    const raw = bytes.toString('latin1');
    const objects = new Map();
    for (const match of raw.matchAll(/(\d+) 0 obj\s*([\s\S]*?)endobj/g))
        objects.set(Number(match[1]), match[2]);
    const maps = new Map();
    for (const [number, body] of objects) {
        const reference = body.match(/\/ToUnicode (\d+) 0 R/);
        if (!reference)
            continue;
        const cmap = objects.get(Number(reference[1])) || '';
        const values = new Map();
        for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
            for (const row of block[1].matchAll(/<([\da-f]+)>\s*<([\da-f]+)>/gi)) {
                let decoded = '';
                for (let index = 0; index < row[2].length; index += 4)
                    decoded += String.fromCharCode(parseInt(row[2].slice(index, index + 4), 16));
                values.set(row[1].toLowerCase(), decoded);
            }
        }
        for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
            for (const range of block[1].matchAll(/<([\da-f]+)>\s*<([\da-f]+)>\s*\[([\s\S]*?)\]/gi)) {
                let code = parseInt(range[1], 16);
                for (const entry of range[3].matchAll(/<([\da-f\s]*)>/gi)) {
                    const hex = entry[1].replace(/\s/g, '');
                    let decoded = '';
                    for (let index = 0; index < hex.length; index += 4)
                        decoded += String.fromCharCode(parseInt(hex.slice(index, index + 4), 16));
                    values.set(code.toString(16).padStart(4, '0'), decoded);
                    code += 1;
                }
            }
        }
        maps.set(number, values);
    }
    const fontMaps = new Map();
    for (const body of objects.values())
        for (const reference of body.matchAll(/\/(F\d+) (\d+) 0 R/g)) {
            const map = maps.get(Number(reference[2]));
            if (map)
                fontMaps.set(reference[1], map);
        }
    const contentIds = new Set();
    for (const body of objects.values())
        if (/\/Type \/Page\b/.test(body)) {
            const content = body.match(/\/Contents (\d+) 0 R/);
            if (content)
                contentIds.add(Number(content[1]));
        }
    let result = '';
    for (const number of contentIds) {
        const stream = (objects.get(number) || '').match(/stream\r?\n([\s\S]*?)\r?\nendstream/)?.[1] || '';
        let font = '';
        for (const token of stream.matchAll(/\/(F\d+) [\d.]+ Tf|<([\da-f]+)>/gi)) {
            if (token[1]) {
                font = token[1];
                continue;
            }
            const map = fontMaps.get(font);
            const hex = token[2].toLowerCase();
            if (map)
                for (let index = 0; index < hex.length; index += 4)
                    result += map.get(hex.slice(index, index + 4)) || '';
            else
                result += Buffer.from(hex, 'hex').toString('latin1');
        }
    }
    return result;
}
