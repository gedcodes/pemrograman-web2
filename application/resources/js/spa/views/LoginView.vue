<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ApiError } from '../api/client';
import { masuk } from '../stores/auth';
import { toast } from '../stores/toast';

const route = useRoute();
const router = useRouter();

const email = ref('');
const password = ref('');
const ingat = ref(false);
const mengirim = ref(false);
const galat = ref<string | null>(null);
const galatField = ref<Record<string, string>>({});

async function kirim() {
    mengirim.value = true;
    galat.value = null;
    galatField.value = {};

    try {
        await masuk(email.value, password.value, ingat.value);
        toast.sukses('Selamat datang kembali.');

        const lanjut =
            typeof route.query.lanjut === 'string' ? route.query.lanjut : '/';
        await router.push(lanjut);
    } catch (e) {
        if (e instanceof ApiError) {
            galat.value = e.message;
            galatField.value = {
                email: e.field('email') ?? '',
                password: e.field('password') ?? '',
            };
        } else {
            galat.value = 'Terjadi kesalahan tak terduga.';
        }
    } finally {
        mengirim.value = false;
    }
}
</script>

<template>
    <div class="layar">
        <div class="panel">
            <div class="brand">
                <span class="brand-mark">SA</span>
                <div>
                    <h1>Toko Sari Amerta</h1>
                    <p class="caption">Admin Panel Point of Sales</p>
                </div>
            </div>

            <form class="stack" novalidate @submit.prevent="kirim">
                <p v-if="galat" class="galat-kotak" role="alert">{{ galat }}</p>

                <div class="field">
                    <label for="email">Email</label>
                    <input
                        id="email"
                        v-model="email"
                        type="email"
                        class="input"
                        :class="{ 'is-error': galatField.email }"
                        autocomplete="username"
                        required
                        autofocus
                    />
                    <p v-if="galatField.email" class="field-error">
                        {{ galatField.email }}
                    </p>
                </div>

                <div class="field">
                    <label for="password">Kata sandi</label>
                    <input
                        id="password"
                        v-model="password"
                        type="password"
                        class="input"
                        :class="{ 'is-error': galatField.password }"
                        autocomplete="current-password"
                        required
                    />
                    <p v-if="galatField.password" class="field-error">
                        {{ galatField.password }}
                    </p>
                </div>

                <label class="row ingat">
                    <input v-model="ingat" type="checkbox" />
                    <span class="caption">Ingat saya di perangkat ini</span>
                </label>

                <button
                    class="btn btn-primary btn-lg btn-block"
                    type="submit"
                    :disabled="mengirim"
                >
                    {{ mengirim ? 'Memeriksa…' : 'Masuk' }}
                </button>
            </form>
        </div>
    </div>
</template>

<style scoped>
.layar {
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: var(--space-4);
    background: var(--surface-canvas);
}

.panel {
    width: 100%;
    max-width: 420px;
    background: var(--surface-raised);
    border-radius: var(--radius-xl);
    padding: var(--space-8);
    box-shadow: var(--shadow-raised-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
}

.brand {
    display: flex;
    align-items: center;
    gap: var(--space-3);
}

.brand h1 {
    font: var(--text-h2);
    letter-spacing: var(--tracking-h2);
}

.brand-mark {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    flex: 0 0 48px;
    border-radius: var(--radius-md);
    background: var(--teal-700);
    color: #fff;
    font: var(--text-h3);
}

.galat-kotak {
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    background: var(--danger-bg);
    color: var(--danger-text);
    font: var(--text-small);
}

.ingat {
    cursor: pointer;
}
</style>
