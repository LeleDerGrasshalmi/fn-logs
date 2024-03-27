const fullProfileUpdate = "LogProfileSys: MCP-Profile: Full profile update";
const fullProfileUpdateRegex = /\(rev=(?<rvn>\d+), version=(?<version>\w+)@w=(?<wipeNumber>\d+)\) for (?<displayName>.+) accountId=(MCP:|)(?<accountId>[a-f0-9]{32}) profileId=(?<profileId>\w+)/;

const initMetadata = "LogInit: ";
const initMetadataRegex = /LogInit: (?<key>.+)(: |=)(?<value>.+)/;

const csvProfilerMetadata = "LogCsvProfiler: Display: Metadata set : ";
const csvProfilerMetadataRegex = /(?<key>\w+)="(?<value>.+)"/;

const timeRegex = /\[(?<year>\d{4}).(?<month>\d{2}).(?<date>\d{2})-(?<hour>\d{2}).(?<minute>\d{2}).(?<second>\d{2}):(?<millisecond>\d{3})\]/;

const errorRegex = /Raw=(?<response>.+)/;
const errorStatusCodeRegex = /(code|Code|HttpResult|Status)(: |=)(?<statusCode>\d+)/;

const mmsMessage = "LogMatchmakingServiceClient: Verbose: HandleWebSocketMessage - Received message: ";
const mmsMessageRegex = /Received message: "(?<message>.+)"/;

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

export interface MMSError {
    time: string;
    payload: {
        code: number;
        reason: string;
    };
}

export interface AnalyzedLogOutput {
    meta: {
        executableName: string | null;
        platform: string | null;
        branch: string | null;
        buildConfig: string | null;
        buildVersion: string | null;
        engineVersion: string | null;
        netCL: number | null;

        compiledAt: string | null;
        compiledWith: string | null;
        compiledWithVersion: string | null;
    };
    events: {
        profileUpdates: ProfileUpdate[];
        errors: APIResponseError[];
        mmsErrors: MMSError[];
    };
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

const tryParseJson = (response: string): APIResponseError['data'] => {
    // errors may be inside quotation marks, so remove those
    const data = response.startsWith('"') && response.endsWith('"')
        ? response.substring(1, response.length - 1)
        : response;

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
        meta: {
            executableName: null,
            platform: null,
            branch: null,
            buildConfig: null,
            buildVersion: null,
            engineVersion: null,
            netCL: null,

            compiledAt: null,
            compiledWith: null,
            compiledWithVersion: null,
        },
        events: {
            profileUpdates: [],
            errors: [],
            mmsErrors: [],
        },
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
                output.events.profileUpdates.push({
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

        // Init Metadata
        if (line.startsWith(initMetadata)) {
            const groups = line.match(initMetadataRegex)?.groups;

            // See https://github.com/EpicGames/UnrealEngine/blob/072300df18a94f18077ca20a14224b5d99fee872/Engine/Source/Runtime/Core/Private/Misc/App.cpp#L378
            if (groups?.key && groups?.value) {
                switch (groups.key) {
                    case 'ExecutableName':
                        output.meta.executableName = groups.value;
                        break;

                    case 'Platform':
                        output.meta.platform = groups.value;
                        break;

                    case 'Branch Name':
                        output.meta.branch = groups.value;
                        break;

                    case 'Build':
                        output.meta.buildVersion = groups.value;
                        break;

                    case 'Build Configuration':
                        output.meta.buildConfig = groups.value;
                        break;

                    case 'Engine Version':
                        output.meta.engineVersion = groups.value;
                        break;

                    case 'Net CL':
                        output.meta.netCL = parseInt(groups.value);
                        break;

                    case 'Compiled (64-bit)':
                    case 'Compiled (32-bit)':
                        output.meta.compiledAt = new Date(groups.value).toISOString()
                        break;

                    case 'Compiled with Clang':
                        output.meta.compiledWith = 'Clang';
                        output.meta.compiledWithVersion = groups.value;
                        break;

                    case 'Compiled with ICL':
                        output.meta.compiledWith = 'ICL';
                        output.meta.compiledWithVersion = groups.value;
                        break;

                    case 'Compiled with Visual C++':
                        output.meta.compiledWith = 'Visual C++';
                        output.meta.compiledWithVersion = groups.value;
                        break;

                    default:
                        break;
                }
            }

            continue;
        }

        // CSV Profiler Metadata
        if (line.startsWith(csvProfilerMetadata)) {
            const groups = line.match(csvProfilerMetadataRegex)?.groups;

            // See https://github.com/EpicGames/UnrealEngine/blob/072300df18a94f18077ca20a14224b5d99fee872/Engine/Source/Runtime/Core/Private/ProfilingDebugging/CsvProfiler.cpp#L2797
            if (groups?.key && groups?.value) {
                switch (groups.key) {
                    case 'platform':
                        output.meta.platform = groups.value;
                        break;

                    case 'config':
                        output.meta.buildConfig = groups.value;
                        break;

                    case 'buildversion':
                        output.meta.buildVersion = groups.value;
                        break;

                    case 'engineversion':
                        output.meta.engineVersion = groups.value;
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

                output.events.errors.push({
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

            // Multi line errors may use the single line format with "Raw={...}"
            let firstLineErrorStartIndex = lines[startLineIndex].lastIndexOf(('Raw='));

            if (firstLineErrorStartIndex !== -1) {
                // some multi line errors may use the single line format with Raw={...} so we need to
                // support that aswell
                firstLineErrorStartIndex += "Raw=".length - 1;
            } else {
                // But some may also use "Message : {...}" so support this aswell
                firstLineErrorStartIndex = lines[startLineIndex].lastIndexOf((':'));
            }

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

            output.events.errors.push({
                time: parseTime(firstLogEntryLine),
                statusCode: statusCode ? parseInt(statusCode) : null,
                data: tryParseJson(errorData),
            });

            continue;
        }

        // MMS Errors
        if (line.includes(mmsMessage)) {
            const message = line.match(mmsMessageRegex)?.groups?.message;

            if (message) {
                const parsed = tryParseJson(message);

                if (typeof parsed === 'object'
                    && parsed?.name === 'Error'
                    && typeof parsed?.payload === 'object'
                ) {
                    output.events.mmsErrors.push({
                        time: parseTime(line),
                        payload: <MMSError['payload']>parsed.payload,
                    });
                }
            }

            continue;
        }
    }

    return output;
};

export default analyzeLog;