#include <metal_stdlib>
using namespace metal;

kernel void coalescedKernel(
    device const float* in [[buffer(0)]],
    device float* out [[buffer(1)]],
    constant uint& n [[buffer(2)]],
    constant float& scale [[buffer(3)]],
    uint gid [[thread_position_in_grid]])
{
    if (gid >= n) return;
    out[gid] = in[gid] * scale;
}

kernel void strideKernel(
    device const float* in [[buffer(0)]],
    device float* out [[buffer(1)]],
    constant uint& n [[buffer(2)]],
    constant uint& stride [[buffer(3)]],
    constant float& scale [[buffer(4)]],
    uint gid [[thread_position_in_grid]])
{
    if (gid >= n) return;
    uint idx = (gid * stride) % n;
    out[gid] = in[idx] * scale;
}

kernel void gatherKernel(
    device const float* in [[buffer(0)]],
    device float* out [[buffer(1)]],
    device const uint* indices [[buffer(2)]],
    constant uint& n [[buffer(3)]],
    constant float& scale [[buffer(4)]],
    uint gid [[thread_position_in_grid]])
{
    if (gid >= n) return;
    uint idx = indices[gid];
    out[gid] = in[idx] * scale;
}
