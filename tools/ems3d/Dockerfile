# EMS3D build environment: APBS 3.4.1 (Debian package), PDB2PQR/PROPKA, OpenMM + PDBFixer.
# The APBS Windows release zip is flagged by Microsoft Defender on this machine, so the whole
# electrostatics pipeline runs in Linux.
#
#   docker build -t ramrt-ems3d tools/ems3d
#   docker run --rm -v "<clinical_risk_calculator>:/app" ramrt-ems3d python /app/tools/ems3d/build_ems3d.py --help
FROM debian:trixie-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends apbs python3 python3-venv ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/venv \
 && /opt/venv/bin/pip install --no-cache-dir numpy scipy biopython pdb2pqr openmm pdbfixer
ENV PATH="/opt/venv/bin:${PATH}" OMP_NUM_THREADS=1 OPENMM_CPU_THREADS=1
WORKDIR /app
