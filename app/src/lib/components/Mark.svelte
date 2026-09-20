<script lang="ts">
	let { size = 22, color = 'var(--color-diamond-500)', label = '' } = $props();
</script>

<span
	aria-hidden={label ? undefined : 'true'}
	aria-label={label || undefined}
	role={label ? 'img' : undefined}
	class="inline-block flex-none rotate-45 rounded-[22%]"
	style="width:{size}px;height:{size}px;background:{color}"
></span>
