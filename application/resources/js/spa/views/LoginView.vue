<script setup lang="ts">
import { Eye, EyeOff } from '@lucide/vue';
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ApiError } from '../api/client';
import { halamanAwal, masuk } from '../stores/auth';
import { toast } from '../stores/toast';

const route = useRoute();
const router = useRouter();

const email = ref('');
const password = ref('');
const ingat = ref(false);
const lihatSandi = ref(false);
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

        // Kembali ke halaman yang tadi hendak dibuka; bila tidak ada, ke
        // halaman awal sesuai peran (kasir langsung ke Kasir).
        const lanjut = route.query.lanjut;
        await router.push(typeof lanjut === 'string' ? lanjut : halamanAwal());
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
                    <div class="sandi">
                        <input
                            id="password"
                            v-model="password"
                            :type="lihatSandi ? 'text' : 'password'"
                            class="input"
                            :class="{ 'is-error': galatField.password }"
                            autocomplete="current-password"
                            required
                        />
                        <button
                            type="button"
                            class="btn btn-ghost btn-sm btn-ikon sandi-lihat"
                            :aria-label="
                                lihatSandi
                                    ? 'Sembunyikan kata sandi'
                                    : 'Tampilkan kata sandi'
                            "
                            :aria-pressed="lihatSandi"
                            @click="lihatSandi = !lihatSandi"
                        >
                            <EyeOff
                                v-if="lihatSandi"
                                :size="18"
                                :stroke-width="1.75"
                            />
                            <Eye v-else :size="18" :stroke-width="1.75" />
                        </button>
                    </div>
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
                    :aria-busy="mengirim"
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

.sandi {
    position: relative;
}

.sandi .input {
    padding-right: 48px;
}

.sandi-lihat {
    position: absolute;
    top: 6px;
    right: 6px;
}
</style>
