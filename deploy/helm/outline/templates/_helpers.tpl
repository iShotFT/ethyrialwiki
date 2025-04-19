{{/*
Expand the name of the chart.
*/}}
{{- define "outline.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "outline.fullname" -}}
{{- if (hasKey .Values "fullnameOverride") }}
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
Create chart name and version as used by the chart label.
*/}}
{{- define "outline.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "outline.labels" -}}
helm.sh/chart: {{ include "outline.chart" . }}
{{ include "outline.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "outline.selectorLabels" -}}
app.kubernetes.io/name: {{ include "outline.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "outline.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "outline.fullname" .) (hasKey .Values.serviceAccount "name" | ternary .Values.serviceAccount.name "") }}
{{- else }}
{{- default "default" (hasKey .Values.serviceAccount "name" | ternary .Values.serviceAccount.name "") }}
{{- end }}
{{- end }}

{{/*
Environment variables for database connection
*/}}
{{- define "outline.databaseEnv" -}}
- name: DATABASE_URL
  value: {{ .Values.env.DATABASE_URL | default (printf "postgres://%s:%s@%s:%d/%s?sslmode=disable" .Values.postgresql.auth.username .Values.postgresql.auth.password .Values.postgresql.primary.service.name .Values.postgresql.primary.service.ports.postgresql .Values.postgresql.auth.database) | quote }}
{{- end }}

{{/*
Environment variables for Redis connection
*/}}
{{- define "outline.redisEnv" -}}
- name: REDIS_URL
  value: {{ .Values.env.REDIS_URL | default (printf "redis://%s/0" .Values.redis.master.service.name) | quote }}
{{- end }}

{{/*
Environment variables for OpenSearch connection
*/}}
{{- define "outline.opensearchEnv" -}}
{{- if .Values.opensearch.enabled }}
- name: OPENSEARCH_URL
  valueFrom:
    secretKeyRef:
      name: {{ include "outline.fullname" . }}
      key: OPENSEARCH_URL
- name: OPENSEARCH_SSL_VERIFY
  valueFrom:
    secretKeyRef:
      name: {{ include "outline.fullname" . }}
      key: OPENSEARCH_SSL_VERIFY
{{- if .Values.opensearch.auth.enabled }}
- name: OPENSEARCH_USERNAME
  valueFrom:
    secretKeyRef:
      name: {{ include "outline.fullname" . }}-opensearch
      key: username
- name: OPENSEARCH_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ include "outline.fullname" . }}-opensearch
      key: admin-password
{{- end }}
{{- end }}
{{- end }}

{{/* Generate environment variables from existing secrets */}}
{{- define "outline.secretEnv" -}}
{{- if .Values.existingSecrets -}}
{{- if .Values.existingSecrets.keys }}
- name: SECRET_KEY
  valueFrom:
    secretKeyRef:
      name: {{ .Values.existingSecrets.keys }}
      key: SECRET_KEY
- name: UTILS_SECRET
  valueFrom:
    secretKeyRef:
      name: {{ .Values.existingSecrets.keys }}
      key: UTILS_SECRET
{{- end }}
{{- if .Values.existingSecrets.auth }}
{{- if .Values.auth.discord.enabled }}
- name: DISCORD_CLIENT_ID
  valueFrom:
    secretKeyRef:
      name: {{ .Values.existingSecrets.auth }}
      key: DISCORD_CLIENT_ID
- name: DISCORD_CLIENT_SECRET
  valueFrom:
    secretKeyRef:
      name: {{ .Values.existingSecrets.auth }}
      key: DISCORD_CLIENT_SECRET
- name: DISCORD_SERVER_ID
  valueFrom:
    secretKeyRef:
      name: {{ .Values.existingSecrets.auth }}
      key: DISCORD_SERVER_ID
{{- end }}
{{- end }}
{{- if and .Values.existingSecrets.s3 (eq .Values.env.FILE_STORAGE "s3") }}
- name: AWS_ACCESS_KEY_ID
  valueFrom:
    secretKeyRef:
      name: {{ .Values.existingSecrets.s3 }}
      key: AWS_ACCESS_KEY_ID
- name: AWS_SECRET_ACCESS_KEY
  valueFrom:
    secretKeyRef:
      name: {{ .Values.existingSecrets.s3 }}
      key: AWS_SECRET_ACCESS_KEY
{{- end }}
{{- if .Values.existingSecrets.notion }}
- name: NOTION_CLIENT_ID
  valueFrom:
    secretKeyRef:
      name: {{ .Values.existingSecrets.notion }}
      key: NOTION_CLIENT_ID
- name: NOTION_CLIENT_SECRET
  valueFrom:
    secretKeyRef:
      name: {{ .Values.existingSecrets.notion }}
      key: NOTION_CLIENT_SECRET
{{- end }}
{{- if .Values.existingSecrets.opensearch }}
- name: OPENSEARCH_URL
  valueFrom:
    secretKeyRef:
      name: {{ .Values.existingSecrets.opensearch }}
      key: OPENSEARCH_URL
- name: OPENSEARCH_USERNAME
  valueFrom:
    secretKeyRef:
      name: {{ .Values.existingSecrets.opensearch }}
      key: OPENSEARCH_USERNAME
- name: OPENSEARCH_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ .Values.existingSecrets.opensearch }}
      key: OPENSEARCH_PASSWORD
- name: OPENSEARCH_SSL_VERIFY
  valueFrom:
    secretKeyRef:
      name: {{ .Values.existingSecrets.opensearch }}
      key: OPENSEARCH_SSL_VERIFY
{{- end }}
{{- end }}
{{- end -}} 