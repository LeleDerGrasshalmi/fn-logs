<script lang="ts">
	import type { PageData } from './$types';

	export let data: PageData;

	let files: FileList;
	let input: HTMLInputElement;
	let errorMessage: string | null = null;

	const downloadFromUrl = (url: string, filename?: string) => {
		const a = document.createElement('a');

		a.href = url;

		if (filename) {
			a.download = filename;
		}

		document.body.appendChild(a);
		a.click();

		document.body.removeChild(a);
	};

	const uploadLog = async () => {
		// reset error message
		errorMessage = null;

		const file = files?.item(0);

		if (!file) {
			errorMessage = `You must first select a file`;

			return;
		}

		if (!file.name.endsWith('.log') && !file.name.endsWith('.txt')) {
			errorMessage = `It appears that '${file.name}' is not a valid fortnite log file'`;

			return;
		}

		const formData = new FormData();

		formData.set('file', file, file.name);

		const res = await fetch('/api/upload-log', {
			method: 'POST',
			body: formData
		});

		const json: Record<string, unknown> = await res.json();

		if (typeof json?.message === 'string') {
			errorMessage = `Upload failed - Status ${res.status} ${res.statusText}: ${json.message}`;

			return;
		}

		const blob = new Blob([JSON.stringify(json, null, 3)], {
			type: 'application/json'
		});

		const objectUrl = URL.createObjectURL(blob);

		downloadFromUrl(objectUrl, file.name.replace('.log', '-output.json'));

		URL.revokeObjectURL(objectUrl);
	};

	const downloadClient = async () => {
		// reset error message
		errorMessage = null;

		const res = await fetch('/api/upload-client');
		const resContent = await res.text();

		if (!res.ok) {
			errorMessage = `Client downloader failed - Status ${res.status} ${res.statusText}: ${resContent}`;

			return;
		}

		downloadFromUrl(resContent);
	};
</script>

<svelte:head>
	<title>FN-Logs Tool</title>
	<meta
		name="description"
		content="FNLogs is a open-source tool that analyzes your fortnite log files."
	/>
</svelte:head>

<div class="container h-full mx-auto flex justify-center items-center mt-4">
	<div class="text-center">
		<h1 class="h1">FN-Logs</h1>

		<p class="my-4">
			This Project is
			<a href={data.repository} target="_blank" class="font-bold"> Open Source</a>
		</p>

		<div class="space-y-5 mb-4">
			<div class="text-left">
				<p>The idea is to automatically collect data from fortnite logs:</p>

				<li>Profile Versions</li>
				<li>API Errors</li>
				<li>MMS Errors</li>
				<li>to be continued ...</li>
			</div>

			<div class="text-left">
				<p>We have tested the following log files:</p>

				<li>EpicGamesLauncher</li>
				<li>FortniteGame</li>
				<li>UnrealEditorFortnite</li>
				<li>WorldExplorers</li>
			</div>

			<div class="text-left">
				<p>The following log files are known to be unsupported:</p>

				<li>BuildPatchTool</li>
				<li>ShooterGame</li>
			</div>
		</div>

		{#if data.storageEnabled}
			<div class="mt-2 mb-2 code">
				<p class="font-bold text-xl">STORAGE DISCLAIMER</p>

				<div class="mt-2 mb-2">
					<p>We store submitted logs in our storage.</p>
					<p>So we can analyze the logs later and get more data.</p>
				</div>
			</div>
		{/if}

		<div class="mb-4 flex gap-2">
			<div>
				<form>
					<p class="font-bold text-2xl mb-2">Analyze your log</p>

					<input bind:files type="file" accept=".log" bind:this={input} />

					<div class="mt-2 flex flex-row gap-2 justify-center">
						<button class="mt-2 btn variant-filled" on:click={async () => await uploadLog()}>
							Submit
						</button>

						<button class="mt-2 btn variant-filled" on:click={() => (input.value = '')}>
							Clear
						</button>
					</div>

					{#if errorMessage}
						<p class="code mt-2">
							{errorMessage}
						</p>
					{/if}
				</form>
			</div>

			<div>
				<p class="font-bold text-2xl mb-2">Auto analyze your logs</p>

				<p>To learn how to configure and use the</p>
				<p>auto uploader client check out the repo</p>

				<div class="mt-2 flex flex-row gap-2 justify-center">
					<button class="mt-2 btn variant-filled" on:click={async () => await downloadClient()}>
						Download Client
					</button>

					<button class="mt-2 btn variant-filled">
						<a href={data.clientRepository} target="_blank">Goto Client Repo</a>
					</button>
				</div>
			</div>
		</div>
	</div>
</div>
