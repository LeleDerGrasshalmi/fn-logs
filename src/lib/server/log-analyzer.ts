const fullProfileUpdate = "LogProfileSys: MCP-Profile: Full profile update";
const fullProfileUpdateRegex = /\(rev=(?<rvn>\d+), version=(?<version>\w+)@w=(?<wipeNumber>\d+)\) for (?<displayName>.+) accountId=(MCP:|)(?<accountId>[a-f0-9]{32}) profileId=(?<profileId>\w+)/;

const metadata = "LogCsvProfiler: Display: Metadata set : ";
const metadataRegex = /(?<key>\w+)="(?<value>.+)"/;

const timeRegex = /\[(?<year>\d{4}).(?<month>\d{2}).(?<date>\d{2})-(?<hour>\d{2}).(?<minute>\d{2}).(?<second>\d{2}):(?<millisecond>\d{3})\]/;

const errorRegex = /Raw=(?<response>.+)/;
const errorStatusCodeRegex = /(code|Code|HttpResult)(: |=)(?<statusCode>\d+)/;

export interface ProfileUpdate {
    time: string;
    accountId: string;
    displayName: string;
    profileId: string;
    version: string;
    rvn: number;
    wipeNumber: number;
}

export interface APIResponseError {
    time: string;
    statusCode: number | null;
    data: Record<string, undefined> | string;
}

export interface AnalyzedLogOutput {
    platform: string | null;
    buildVersion: string | null;
    engineVersion: string | null;
    profileUpdates: ProfileUpdate[];
    errors: APIResponseError[];
}

const hasTime = (line: string) =>
    line[0] === '[' // start
    && line[5] === '.' // year/month
    && line[8] === '.' // month/date
    && line[11] === '-' // date/hour
    && line[14] === '.' // hour/minute
    && line[17] === '.' // minute/second
    && line[20] === ':' // second/millisecond
    && line[24] === ']'; // end

const parseTime = (line: string) => {
    const match = line.match(timeRegex);

    if (match?.groups?.year) {
        const groups = match.groups;
        const date = new Date(`${groups.year}.${groups.month}.${groups.date} ${groups.hour}:${groups.minute}:${groups.second}.${groups.millisecond}`);

        return date.toISOString();
    }

    return line.substring(1, 24);
};

const tryFindAbsoluteIndex = (lines: string[], index: number, searchForStart: boolean) => {
    for (let j = 0; j < 10; j += 1) {
        const absoluteIndex = searchForStart
            ? index - j
            : index + j;

        if (hasTime(lines[absoluteIndex])) {
            return absoluteIndex;
        }
    }

    return -1;
};

const tryParseJson = (data: string): APIResponseError['data'] => {
    try {
        return JSON.parse(data);
    } catch {
        // invalid json (e.g special chars) or something, so store it as text

        return data;
    }
}

const analyzeLog = (file: string) => {
    const lines = file.split("\n");

    const output: AnalyzedLogOutput = {
        platform: null,
        buildVersion: null,
        engineVersion: null,
        profileUpdates: [],
        errors: [],
    };

    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i].trim();

        // MCP Profile Update
        if (line.includes(fullProfileUpdate)) {
            const groups = line.match(fullProfileUpdateRegex)?.groups;

            if (groups?.rvn
                && groups?.version
                && groups?.wipeNumber
                && groups?.displayName
                && groups?.accountId
                && groups?.profileId
            ) {
                output.profileUpdates.push({
                    time: parseTime(line),
                    accountId: groups.accountId,
                    displayName: groups.displayName,
                    profileId: groups.profileId,
                    version: groups.version,
                    rvn: parseInt(groups.rvn),
                    wipeNumber: parseInt(groups.wipeNumber),
                });
            }

            continue;
        }

        // Metadata
        if (line.startsWith(metadata)) {
            const groups = line.match(metadataRegex)?.groups;

            if (groups?.key && groups?.value) {
                switch (groups.key) {
                    case 'platform':
                        output.platform = groups.value;
                        break;

                    case 'buildversion':
                        output.buildVersion = groups.value;
                        break;

                    case 'engineversion':
                        output.engineVersion = groups.value;
                        break;

                    default:
                        break;
                }
            }

            continue;
        }

        // Errors (single-line)
        if (line.includes(' Raw={"') && line.endsWith('"}')) {
            //
            const groups = line.match(errorRegex)?.groups;

            if (groups?.response) {
                const statusCode = line.match(errorStatusCodeRegex)?.groups?.statusCode;

                output.errors.push({
                    time: parseTime(line),
                    statusCode: statusCode ? parseInt(statusCode) : null,
                    data: tryParseJson(groups.response),
                });
            }

            continue;
        }

        // Errors (multi-line)
        if (line.includes('"errorCode"') && !hasTime(line)) {
            const startLineIndex = tryFindAbsoluteIndex(lines, i, true);

            // failed to determine starting line
            if (startLineIndex === -1) {
                console.debug("failed to find multi line error start", i, line);

                continue;
            }

            const endLineIndex = tryFindAbsoluteIndex(lines, i, false)

            // failed to determine end line
            if (endLineIndex === -1) {
                console.debug("failed to find multi line error end", i, line);

                continue;
            }

            // Known multi line errors end have a colon before the actual response error json starts
            const firstLineErrorStartIndex = lines[startLineIndex].lastIndexOf((':'));

            if (firstLineErrorStartIndex === -1) {
                console.debug(`failed to find multi line error start in first line (${startLineIndex} - ${endLineIndex})`, line);

                continue;
            }

            const firstLogEntryLine = lines[startLineIndex];
            const errorData = lines
                .slice(startLineIndex, endLineIndex)
                .join('')
                .substring(firstLineErrorStartIndex + 1)
                .trim();

            const statusCode = firstLogEntryLine.match(errorStatusCodeRegex)?.groups?.statusCode;

            output.errors.push({
                time: parseTime(firstLogEntryLine),
                statusCode: statusCode ? parseInt(statusCode) : null,
                data: tryParseJson(errorData),
            });
        }
    }

    return output;
};

export default analyzeLog;