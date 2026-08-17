package services

import "testing"

func TestWorkspaceLoadReturnsRecoveryWithoutStorage(t *testing.T) {
	recovery := &RecoveryInfo{Message: "database failed", DatabasePath: "/tmp/work-tools.db", LogPath: "/tmp/work-tools.log"}
	service := NewWorkspaceService(nil, recovery)

	result, err := service.Load()
	if err != nil {
		t.Fatal(err)
	}
	if result.Recovery == nil || result.Recovery.DatabasePath != recovery.DatabasePath || result.State != nil {
		t.Fatalf("load result = %#v", result)
	}
}
