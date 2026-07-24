/**
 * Container Exporter Utility
 * Generates docker-compose.yml, Dockerfile, and Kubernetes YAML specs
 * from Docker container inspect data.
 */

function cleanContainerName(name) {
  return (name || '').replace(/^\//, '') || 'container';
}

function generateCompose(info) {
  const serviceName = cleanContainerName(info.Name);
  const config = info.Config || {};
  const hostConfig = info.HostConfig || {};
  const networkSettings = info.NetworkSettings || {};

  let yaml = `version: '3.8'\n\nservices:\n  ${serviceName}:\n`;

  // Image
  if (config.Image) {
    yaml += `    image: ${config.Image}\n`;
  }

  // Container Name
  yaml += `    container_name: ${serviceName}\n`;

  // Restart Policy
  const restart = hostConfig.RestartPolicy?.Name;
  if (restart && restart !== 'no' && restart !== '') {
    yaml += `    restart: ${restart}\n`;
  }

  // Entrypoint
  if (config.Entrypoint && config.Entrypoint.length > 0) {
    const entrypoint = Array.isArray(config.Entrypoint) ? config.Entrypoint : [config.Entrypoint];
    if (entrypoint.length === 1) {
      yaml += `    entrypoint: ${entrypoint[0]}\n`;
    } else {
      yaml += `    entrypoint:\n` + entrypoint.map(e => `      - "${e.replace(/"/g, '\\"')}"`).join('\n') + '\n';
    }
  }

  // Command
  if (config.Cmd && config.Cmd.length > 0) {
    const cmd = Array.isArray(config.Cmd) ? config.Cmd : [config.Cmd];
    if (cmd.length === 1) {
      yaml += `    command: ${cmd[0]}\n`;
    } else {
      yaml += `    command:\n` + cmd.map(c => `      - "${c.replace(/"/g, '\\"')}"`).join('\n') + '\n';
    }
  }

  // Working Dir
  if (config.WorkingDir) {
    yaml += `    working_dir: ${config.WorkingDir}\n`;
  }

  // User
  if (config.User) {
    yaml += `    user: "${config.User}"\n`;
  }

  // Environment Variables
  const envs = config.Env || [];
  // Filter default path/hostname envs if needed or include user envs
  if (envs.length > 0) {
    yaml += `    environment:\n`;
    envs.forEach(envStr => {
      const idx = envStr.indexOf('=');
      if (idx !== -1) {
        const key = envStr.substring(0, idx);
        const val = envStr.substring(idx + 1);
        yaml += `      - ${key}=${val}\n`;
      }
    });
  }

  // Ports
  const portBindings = hostConfig.PortBindings || {};
  const portsList = [];
  Object.entries(portBindings).forEach(([containerPort, bindings]) => {
    if (Array.isArray(bindings) && bindings.length > 0) {
      bindings.forEach(b => {
        const hostPort = b.HostPort;
        const hostIp = b.HostIp ? `${b.HostIp}:` : '';
        portsList.push(`${hostIp}${hostPort}:${containerPort}`);
      });
    }
  });
  if (portsList.length > 0) {
    yaml += `    ports:\n`;
    portsList.forEach(p => {
      yaml += `      - "${p}"\n`;
    });
  }

  // Volumes / Mounts
  const mounts = info.Mounts || [];
  const binds = hostConfig.Binds || [];
  const volumesList = [];

  if (mounts.length > 0) {
    mounts.forEach(m => {
      const src = m.Source || m.Name;
      const dest = m.Destination;
      const mode = m.RW === false ? 'ro' : 'rw';
      if (src && dest) {
        volumesList.push(`${src}:${dest}:${mode}`);
      }
    });
  } else if (binds.length > 0) {
    binds.forEach(b => volumesList.push(b));
  }

  if (volumesList.length > 0) {
    yaml += `    volumes:\n`;
    volumesList.forEach(v => {
      yaml += `      - ${v}\n`;
    });
  }

  // Networks
  const networks = Object.keys(networkSettings.Networks || {});
  if (networks.length > 0 && !(networks.length === 1 && networks[0] === 'bridge')) {
    yaml += `    networks:\n`;
    networks.forEach(net => {
      yaml += `      - ${net}\n`;
    });
  }

  // Memory Limit
  if (hostConfig.Memory && hostConfig.Memory > 0) {
    const memMb = Math.round(hostConfig.Memory / (1024 * 1024));
    yaml += `    mem_limit: ${memMb}m\n`;
  }

  // Networks section at root if custom networks
  const customNets = networks.filter(n => n !== 'bridge' && n !== 'host' && n !== 'none');
  if (customNets.length > 0) {
    yaml += `\nnetworks:\n`;
    customNets.forEach(net => {
      yaml += `  ${net}:\n    external: true\n`;
    });
  }

  return yaml;
}

function generateDockerfile(info) {
  const config = info.Config || {};

  let df = `# Reconstructed Dockerfile for ${cleanContainerName(info.Name)}\n`;
  df += `# Image base: ${config.Image || 'unknown'}\n\n`;

  df += `FROM ${config.Image || 'scratch'}\n\n`;

  // User
  if (config.User) {
    df += `USER ${config.User}\n`;
  }

  // Workdir
  if (config.WorkingDir) {
    df += `WORKDIR ${config.WorkingDir}\n`;
  }

  // Environment variables
  const envs = config.Env || [];
  const systemEnvs = ['PATH', 'HOSTNAME', 'HOME'];
  const userEnvs = envs.filter(e => {
    const key = e.split('=')[0];
    return !systemEnvs.includes(key);
  });

  if (userEnvs.length > 0) {
    df += `\n# Environment Variables\n`;
    userEnvs.forEach(envStr => {
      const idx = envStr.indexOf('=');
      if (idx !== -1) {
        const key = envStr.substring(0, idx);
        const val = envStr.substring(idx + 1);
        df += `ENV ${key}="${val.replace(/"/g, '\\"')}"\n`;
      }
    });
  }

  // Exposed Ports
  const exposedPorts = Object.keys(config.ExposedPorts || {});
  if (exposedPorts.length > 0) {
    df += `\n# Exposed Ports\n`;
    exposedPorts.forEach(port => {
      df += `EXPOSE ${port}\n`;
    });
  }

  // Volumes
  const volumes = Object.keys(config.Volumes || {});
  if (volumes.length > 0) {
    df += `\n# Volumes\n`;
    volumes.forEach(vol => {
      df += `VOLUME ["${vol}"]\n`;
    });
  }

  // Entrypoint
  if (config.Entrypoint && config.Entrypoint.length > 0) {
    const entrypoint = Array.isArray(config.Entrypoint) ? config.Entrypoint : [config.Entrypoint];
    df += `\nENTRYPOINT [${entrypoint.map(e => `"${e.replace(/"/g, '\\"')}"`).join(', ')}]\n`;
  }

  // Cmd
  if (config.Cmd && config.Cmd.length > 0) {
    const cmd = Array.isArray(config.Cmd) ? config.Cmd : [config.Cmd];
    df += `CMD [${cmd.map(c => `"${c.replace(/"/g, '\\"')}"`).join(', ')}]\n`;
  }

  return df;
}

function generateK8sYaml(info) {
  const name = cleanContainerName(info.Name).toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const config = info.Config || {};
  const hostConfig = info.HostConfig || {};

  let yaml = `apiVersion: v1\nkind: Pod\nmetadata:\n  name: ${name}\n  labels:\n    app: ${name}\nspec:\n  containers:\n    - name: ${name}\n      image: ${config.Image}\n`;

  // Command & Args
  if (config.Entrypoint && config.Entrypoint.length > 0) {
    yaml += `      command:\n` + config.Entrypoint.map(e => `        - "${e.replace(/"/g, '\\"')}"`).join('\n') + '\n';
  }
  if (config.Cmd && config.Cmd.length > 0) {
    yaml += `      args:\n` + config.Cmd.map(c => `        - "${c.replace(/"/g, '\\"')}"`).join('\n') + '\n';
  }

  // WorkingDir
  if (config.WorkingDir) {
    yaml += `      workingDir: ${config.WorkingDir}\n`;
  }

  // Environment variables
  const envs = config.Env || [];
  const systemEnvs = ['PATH', 'HOSTNAME', 'HOME'];
  const userEnvs = envs.filter(e => !systemEnvs.includes(e.split('=')[0]));
  if (userEnvs.length > 0) {
    yaml += `      env:\n`;
    userEnvs.forEach(e => {
      const idx = e.indexOf('=');
      const key = e.substring(0, idx);
      const val = e.substring(idx + 1);
      yaml += `        - name: ${key}\n          value: "${val.replace(/"/g, '\\"')}"\n`;
    });
  }

  // Ports
  const exposedPorts = Object.keys(config.ExposedPorts || {});
  if (exposedPorts.length > 0) {
    yaml += `      ports:\n`;
    exposedPorts.forEach(p => {
      const [port, proto] = p.split('/');
      yaml += `        - containerPort: ${port}\n          protocol: ${(proto || 'tcp').toUpperCase()}\n`;
    });
  }

  // Resources
  if (hostConfig.Memory && hostConfig.Memory > 0) {
    const memMb = Math.round(hostConfig.Memory / (1024 * 1024));
    yaml += `      resources:\n        limits:\n          memory: "${memMb}Mi"\n        requests:\n          memory: "${memMb}Mi"\n`;
  }

  // Restart Policy
  const restart = hostConfig.RestartPolicy?.Name;
  const k8sRestart = restart === 'always' ? 'Always' : restart === 'on-failure' ? 'OnFailure' : 'Never';
  yaml += `  restartPolicy: ${k8sRestart}\n`;

  return yaml;
}

function exportContainerSpec(info) {
  return {
    compose: generateCompose(info),
    dockerfile: generateDockerfile(info),
    yaml: generateK8sYaml(info),
    helm: generateHelmChart(info),
  };
}

function generateHelmChart(info) {
  const serviceName = cleanContainerName(info.Name).toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const config = info.Config || {};
  const hostConfig = info.HostConfig || {};

  // Image splitting (repo & tag)
  const fullImage = config.Image || 'nginx:latest';
  const lastColon = fullImage.lastIndexOf(':');
  let imageRepo = fullImage;
  let imageTag = 'latest';
  if (lastColon !== -1 && lastColon > fullImage.lastIndexOf('/')) {
    imageRepo = fullImage.substring(0, lastColon);
    imageTag = fullImage.substring(lastColon + 1);
  }

  // Exposed ports
  const exposedPorts = Object.keys(config.ExposedPorts || {});
  let containerPort = 80;
  if (exposedPorts.length > 0) {
    const p = exposedPorts[0].split('/')[0];
    containerPort = parseInt(p) || 80;
  }

  // Memory limits
  const memMb = hostConfig.Memory && hostConfig.Memory > 0 ? Math.round(hostConfig.Memory / (1024 * 1024)) : 512;

  // Environment variables
  const envs = config.Env || [];
  const systemEnvs = ['PATH', 'HOSTNAME', 'HOME'];
  const userEnvs = {};
  envs.forEach(e => {
    const idx = e.indexOf('=');
    if (idx !== -1) {
      const key = e.substring(0, idx);
      if (!systemEnvs.includes(key)) {
        userEnvs[key] = e.substring(idx + 1);
      }
    }
  });

  // Chart.yaml
  const chartYaml = `apiVersion: v2
name: ${serviceName}
description: A Helm chart for ${serviceName} generated by MobyDock
type: application
version: 0.1.0
appVersion: "${imageTag}"
`;

  // values.yaml
  let valuesYaml = `replicaCount: 1

image:
  repository: ${imageRepo}
  pullPolicy: IfNotPresent
  tag: "${imageTag}"

service:
  type: ClusterIP
  port: ${containerPort}

resources:
  limits:
    memory: ${memMb}Mi
  requests:
    memory: ${Math.round(memMb / 2)}Mi
`;

  if (Object.keys(userEnvs).length > 0) {
    valuesYaml += `\nenv:\n`;
    Object.entries(userEnvs).forEach(([k, v]) => {
      valuesYaml += `  ${k}: "${v.replace(/"/g, '\\"')}"\n`;
    });
  }

  // templates/_helpers.tpl
  const helpersTpl = `{{/*
Expand the name of the chart.
*/}}
{{- define "${serviceName}.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "${serviceName}.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "${serviceName}.labels" -}}
helm.sh/chart: {{ include "${serviceName}.name" . }}-{{ .Chart.Version | replace "+" "_" }}
{{ include "${serviceName}.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "${serviceName}.selectorLabels" -}}
app.kubernetes.io/name: {{ include "${serviceName}.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
`;

  // templates/deployment.yaml
  let deploymentYaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "${serviceName}.fullname" . }}
  labels:
    {{- include "${serviceName}.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "${serviceName}.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "${serviceName}.selectorLabels" . | nindent 8 }}
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.service.port }}
              protocol: TCP
`;

  if (Object.keys(userEnvs).length > 0) {
    deploymentYaml += `          env:
          {{- range $key, $val := .Values.env }}
            - name: {{ $key }}
              value: {{ $val | quote }}
          {{- end }}
`;
  }

  deploymentYaml += `          resources:
            {{- toYaml .Values.resources | nindent 12 }}
`;

  // templates/service.yaml
  const serviceYaml = `apiVersion: v1
kind: Service
metadata:
  name: {{ include "${serviceName}.fullname" . }}
  labels:
    {{- include "${serviceName}.labels" . | nindent 4 }}
spec:
  type: {{ .Values.service.type }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: http
      protocol: TCP
      name: http
  selector:
    {{- include "${serviceName}.selectorLabels" . | nindent 4 }}
`;

  return {
    'Chart.yaml': chartYaml,
    'values.yaml': valuesYaml,
    'templates/_helpers.tpl': helpersTpl,
    'templates/deployment.yaml': deploymentYaml,
    'templates/service.yaml': serviceYaml,
  };
}

module.exports = {
  generateCompose,
  generateDockerfile,
  generateK8sYaml,
  generateHelmChart,
  exportContainerSpec,
};
