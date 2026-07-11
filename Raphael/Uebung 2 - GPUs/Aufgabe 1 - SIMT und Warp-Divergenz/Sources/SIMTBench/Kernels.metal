#include <metal_stdlib>
using namespace metal;

[[clang::noinline]] float mix0(float x) { return fma(1.000123f, x, 0.101f); }
[[clang::noinline]] float mix1(float x) { return fma(0.999987f, x, 0.202f); }
[[clang::noinline]] float mix2(float x) { return fma(1.000311f, x, 0.303f); }
[[clang::noinline]] float mix3(float x) { return fma(0.999731f, x, 0.404f); }
[[clang::noinline]] float mix4(float x) { return fma(1.000451f, x, 0.505f); }
[[clang::noinline]] float mix5(float x) { return fma(0.999521f, x, 0.606f); }
[[clang::noinline]] float mix6(float x) { return fma(1.000271f, x, 0.707f); }
[[clang::noinline]] float mix7(float x) { return fma(0.999401f, x, 0.808f); }

kernel void uniformKernel(
    device const float* in [[buffer(0)]],
    device float* out [[buffer(1)]],
    constant uint& n [[buffer(2)]],
    constant uint& k [[buffer(3)]],
    uint gid [[thread_position_in_grid]])
{
    if (gid >= n) return;

    float x = in[gid];
    const float a = 1.000123f;
    const float b = 0.99991f;
    const float c = 0.314159f;
    const float d = 0.271828f;

    for (uint i = 0; i < k; ++i) {
        x = fma(a, x, b);
        x = fma(c, x, d);
    }

    out[gid] = x;
}

kernel void divergentKernel(
    device const float* in [[buffer(0)]],
    device float* out [[buffer(1)]],
    constant uint& n [[buffer(2)]],
    constant uint& k [[buffer(3)]],
    constant uint& divergence [[buffer(4)]],
    uint gid [[thread_position_in_grid]],
    uint tid [[thread_position_in_threadgroup]])
{
    if (gid >= n) return;

    uint m = max((uint)1, divergence);
    uint branch = tid % m;

    float x = in[gid];

    for (uint i = 0; i < k; ++i) {
        switch (branch & 7u) {
            case 0: x = mix0(x); break;
            case 1: x = mix1(x); break;
            case 2: x = mix2(x); break;
            case 3: x = mix3(x); break;
            case 4: x = mix4(x); break;
            case 5: x = mix5(x); break;
            case 6: x = mix6(x); break;
            default: x = mix7(x); break;
        }
        x = fma(0.99991f, x, 0.123f);
    }

    out[gid] = x;
}
