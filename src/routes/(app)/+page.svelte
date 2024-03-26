<script lang="ts">
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
			<a href="https://github.com/LeleDerGrasshalmi/fn-logs" class="font-bold"> Open Source</a>
		</p>

		<div class="text-left">
			<p>The idea is to automatically collect data from fortnite logs:</p>

			<li>Profile Versions</li>
			<li>API Errors</li>
			<li>MMS Errors</li>
			<li>to be continued ...</li>
		</div>

		<div>
			<form>
				<p class="font-semibold text-xl mb-2">Analyze your log</p>
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
	</div>
</div>
