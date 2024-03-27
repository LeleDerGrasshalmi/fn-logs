<script lang="ts">
	import type { PageData } from './$types';

	export let data: PageData;

	let files: FileList;
	let input: HTMLInputElement;
	let errorMessage: string | null = null;

	const uploadLog = async () => {
		const file = files?.item(0);

		if (!file) {
			errorMessage = `You must first select a file`;

			return;
		}

		if (!file.name.endsWith('.log')) {
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
			errorMessage = `Status ${res.status} ${res.statusText}: ${json.message}`;

			return;
		}

		const blob = new Blob([JSON.stringify(json, null, 3)], {
			type: 'application/json'
		});

		const objectUrl = URL.createObjectURL(blob);
		const a = document.createElement('a');

		a.href = objectUrl;
		a.download = `${file.name.replace('.log', '-output.json')}`;

		document.body.appendChild(a);
		a.click();

		document.body.removeChild(a);

		URL.revokeObjectURL(objectUrl);
	};
</script>

<div class="container h-full mx-auto flex justify-center items-center">
	<div class="space-y-5 mt-4 text-center">
		<h1 class="h1">FN-Logs</h1>

		<p>
			This Project is
			<a href={data.repository} target="_blank" class="font-bold"> Open Source</a>
		</p>

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

		<div>
			<form>
				<p class="font-bold text-2xl mb-2">Analyze your log</p>

				<input bind:files type="file" accept=".log" bind:this={input} />

				{#if data.storageEnabled}
					<div class="mt-2 mb-2 code">
						<p class="font-bold text-xl">STORAGE DISCLAIMER</p>

						<div class="mt-2 mb-2">
							<p>We store submitted logs in our storage.</p>
							<p>So we can analyze the logs later and get more data.</p>
						</div>
					</div>
				{/if}

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
	</div>
</div>
